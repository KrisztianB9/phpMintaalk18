const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
const inditasForm = document.getElementById('inditas');
const inditGomb = document.getElementById('indit-gomb');
const allapot = document.getElementById('allapot');
const visszaszamlalo = document.getElementById('visszaszamlalo');
const probalkozasElem = document.getElementById('probalkozas');
const idoFolyamat = document.getElementById('ido-folyamat');
const kvizTerulet = document.getElementById('kviz');
const naplo = document.getElementById('naplo');
const naploTorlese = document.getElementById('naplo-torlese');
const tamadasok = document.getElementById('tamadasok');
let visszaszamlaloId = null;
let aktivKitoltes = null;
let utolsoInditasValasz = null;

function visszaszamlaloLeallitasa() {
    if (visszaszamlaloId !== null) {
        clearInterval(visszaszamlaloId);
        visszaszamlaloId = null;
    }
}

function visszaszamlaloInditasa(szerverIdoMs, hataridoMs, turelemMp) {
    visszaszamlaloLeallitasa();
    const kezdoHatralevoMs = Math.max(0, Number(hataridoMs) - Number(szerverIdoMs));
    const kliensMonotonKezdes = performance.now();
    visszaszamlalo.dataset.lejart = 'false';
    visszaszamlalo.hidden = false;

    const frissit = () => {
        const hatralevoMs = Math.max(0, kezdoHatralevoMs - (performance.now() - kliensMonotonKezdes));
        const szazalek = kezdoHatralevoMs > 0 ? (hatralevoMs / kezdoHatralevoMs) * 100 : 0;
        idoFolyamat.style.width = `${szazalek}%`;

        if (hatralevoMs === 0) {
            visszaszamlalo.textContent = 'Lejárt az időkeret; a végső határidőt a szerver ellenőrzi.';
            visszaszamlalo.dataset.lejart = 'true';
            visszaszamlaloLeallitasa();
            return;
        }

        const masodperc = Math.ceil(hatralevoMs / 1000);
        const percSzam = Math.floor(masodperc / 60);
        const maradekMasodperc = String(masodperc % 60).padStart(2, '0');
        visszaszamlalo.textContent = `${percSzam}:${maradekMasodperc}`;
        visszaszamlalo.setAttribute('aria-label', `Hátralévő idő a ${turelemMp} másodperces türelmi idővel együtt: ${percSzam} perc ${maradekMasodperc} másodperc`);
    };

    frissit();
    if (kezdoHatralevoMs > 0) {
        visszaszamlaloId = window.setInterval(frissit, 250);
    }
}

function uresNaploUzenet() {
    const uzenet = document.createElement('p');
    uzenet.className = 'log-empty';
    uzenet.textContent = 'Indítsd el a kvízt a forgalom megtekintéséhez.';
    return uzenet;
}

function szerverFolyamat(url, adat = null, status = null) {
    if (/^\/api\/kviz\/\d+\/kitoltes$/.test(url)) {
        const kvizId = url.match(/^\/api\/kviz\/(\d+)\/kitoltes$/)?.[1] ?? '?';

        if (status === null) return 'Próbálkozáskorlát ellenőrzése…';

        if (Number.isInteger(adat?.probalkozasok)) {
            return `SELECT COUNT(*) FROM kitoltesek WHERE kviz_id = ${kvizId} AND felhasznalo = ? → ${adat.probalkozasok}`;
        }

        if (status === 403) return 'CSRF-ellenőrzés elutasítva; adatbázis-lekérdezés nem futott.';
        if (status === 404) return `SELECT id, cim, idokorlat_mp, max_probalkozas FROM kvizek WHERE id = ${kvizId} → nincs találat`;
        if (status >= 400) return 'A kérés elutasítva; az indítás további SQL-lépései nem futottak.';

        const eddigiProbalkozas = Number.isInteger(adat?.probalkozas)
            ? Math.max(0, adat.probalkozas - 1)
            : '?';

        return [
            `SELECT COUNT(*) FROM kitoltesek WHERE kviz_id = ${kvizId} AND felhasznalo = ? → ${eddigiProbalkozas}`,
            'INSERT kitoltesek (token, kezdes = szerveridő)',
            'SELECT id, szoveg FROM opciok WHERE kerdes_id = ? — a „helyes” oszlop nincs a lekérdezésben',
        ].join('\n');
    }

    if (/^\/api\/kitoltes\/[a-f0-9]{32}\/beadas$/.test(url)) {
        return [
            'SELECT kitoltes + kvíz időkorlát token alapján',
            'Ellenőrzés: tulajdonos, beadási állapot és szerveridő',
            'Szerveroldali pontozás: a beküldött opcióhalmazok összehasonlítása',
            'UPDATE kitoltesek SET beadva = ?, pont = ? WHERE id = ? AND beadva IS NULL',
            'INSERT INTO valaszok (kitoltes_id, kerdes_id, opcio_id) VALUES (?, ?, ?)',
        ].join('\n');
    }

    return ['Ismeretlen API-útvonal'];
}

function naploSzakasz(cim, tartalom, osztaly = '') {
    const szakasz = document.createElement('section');
    szakasz.className = 'log-section';

    const fejl = document.createElement('h3');
    fejl.textContent = cim;

    const torzs = document.createElement('pre');
    if (typeof tartalom === 'string') {
        torzs.textContent = tartalom;
    } else {
        torzs.textContent = JSON.stringify(tartalom, null, 2);
    }
    if (osztaly !== '') torzs.classList.add(osztaly);

    szakasz.append(fejl, torzs);
    return { szakasz, torzs };
}

function naploBejegyzes(url, requestHeaders, requestBody) {
    naplo.querySelector('.log-empty')?.remove();

    const bejegyzes = document.createElement('article');
    bejegyzes.className = 'log-entry';

    const fejl = document.createElement('header');
    fejl.className = 'log-entry-header';

    const method = document.createElement('span');
    method.className = 'http-method';
    method.textContent = 'POST';

    const utvonal = document.createElement('code');
    utvonal.className = 'http-path';
    utvonal.textContent = url;

    const statusz = document.createElement('span');
    statusz.className = 'status-code pending';
    statusz.textContent = 'Folyamatban';
    fejl.append(method, utvonal, statusz);

    const tartalom = document.createElement('div');
    tartalom.className = 'log-entry-body';

    const headers = naploSzakasz('Kérés fejlécei', requestHeaders);
    const body = naploSzakasz('Kérés törzse', requestBody);
    const folyamat = naploSzakasz('SQL', szerverFolyamat(url), 'sql');

    const responseHeaders = naploSzakasz('Válasz fejlécei', 'Várakozás a szerverre…');
    const responseBody = naploSzakasz('Válasz törzse', 'Várakozás a szerverre…');
    tartalom.append(headers.szakasz);
    if (Object.keys(requestBody).length > 0) tartalom.append(body.szakasz);
    tartalom.append(folyamat.szakasz, responseHeaders.szakasz, responseBody.szakasz);
    bejegyzes.append(fejl, tartalom);
    naplo.prepend(bejegyzes);

    return { statusz, responseHeaders, responseBody, folyamat };
}

function valaszfejlecek(response) {
    const fejlecek = {};
    for (const [nev, kulcs] of [['Date', 'date'], ['Location', 'location'], ['Content-Type', 'content-type']]) {
        const ertek = response.headers.get(kulcs);
        if (ertek !== null) fejlecek[nev] = ertek;
    }
    return fejlecek;
}

function naploValasz(url, adat) {
    if (/^\/api\/kviz\/\d+\/kitoltes$/.test(url) && adat) {
        if (adat.kerdesek) {
            return {
                kitoltes: adat.kitoltes,
                cim: adat.cim,
                idokorlat_mp: adat.idokorlat_mp,
                kerdesek: adat.kerdesek,
            };
        }
        return Object.prototype.hasOwnProperty.call(adat, 'hiba') ? { hiba: adat.hiba } : adat;
    }

    if (/^\/api\/kitoltes\/[a-f0-9]{32}\/beadas$/.test(url) && adat) {
        const beadasValasz = {};
        for (const mezo of ['pont', 'max', 'eltelt_mp', 'lezarva', 'eredmeny', 'hiba']) {
            if (Object.prototype.hasOwnProperty.call(adat, mezo)) beadasValasz[mezo] = adat[mezo];
        }
        return beadasValasz;
    }

    return adat;
}

async function apiKerdes(url, adat) {
    const requestBody = JSON.stringify(adat);
    const requestHeaders = {
        'X-CSRF-Token': csrfToken.slice(0, 10) + '…' + csrfToken.slice(-6),
        'Content-Type': 'application/json',
    };
    const logSor = naploBejegyzes(url, requestHeaders, adat);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            body: requestBody,
        });

        const nyersValasz = await response.text();
        let eredmeny;
        try {
            eredmeny = nyersValasz === '' ? {} : JSON.parse(nyersValasz);
        } catch {
            eredmeny = { hiba: 'A szerver válasza nem olvasható.', torzs: nyersValasz };
        }

        const fejlecek = valaszfejlecek(response);
        logSor.statusz.textContent = String(response.status);
        logSor.statusz.className = `status-code ${response.ok ? '' : 'error'}`;
        logSor.folyamat.torzs.textContent = szerverFolyamat(url, eredmeny, response.status);
        logSor.responseHeaders.torzs.textContent = JSON.stringify(fejlecek, null, 2);
        logSor.responseBody.torzs.textContent = JSON.stringify(naploValasz(url, eredmeny), null, 2);

        return { ...eredmeny, status: response.status, sikeres: response.ok };
    } catch (error) {
        logSor.statusz.textContent = 'Hálózati hiba';
        logSor.statusz.className = 'status-code error';
        logSor.responseBody.torzs.textContent = JSON.stringify({ hiba: 'Nem sikerült kapcsolódni a szerverhez.' }, null, 2);
        throw error;
    }
}

function eredmenyMegjelenitese(eredmeny) {
    const doboz = document.createElement('div');
    doboz.className = 'eredmeny-doboz';

    const cim = document.createElement('h3');
    cim.textContent = 'Kérdésenkénti eredmény';
    doboz.append(cim);

    eredmeny.forEach((sor, index) => {
        const sorElem = document.createElement('p');
        sorElem.className = `eredmeny-sor ${sor.helyes ? 'helyes' : 'hibas'}`;
        sorElem.textContent = `${index + 1}. kérdés: ${sor.helyes ? 'Helyes' : 'Hibás'} (${sor.pont} / ${sor.max} pont)`;
        doboz.append(sorElem);
    });

    kvizTerulet.append(doboz);
}

function kerdesekMegjelenitese(kerdesek, kitoltesToken) {
    kvizTerulet.replaceChildren();
    const beadasForm = document.createElement('form');
    beadasForm.id = 'beadas';

    for (const kerdes of kerdesek) {
        const blokk = document.createElement('fieldset');
        const cim = document.createElement('legend');
        cim.textContent = kerdes.szoveg;

        const pont = document.createElement('span');
        pont.className = 'kerdes-pont';
        pont.textContent = ` (${kerdes.pont} pont${kerdes.tobbszoros ? ', több helyes' : ''})`;
        cim.append(pont);
        blokk.append(cim);

        for (const opcio of kerdes.opciok) {
            const cimke = document.createElement('label');
            cimke.className = 'opcio';

            const valaszInput = document.createElement('input');
            valaszInput.type = kerdes.tobbszoros ? 'checkbox' : 'radio';
            valaszInput.name = `kerdes-${kerdes.id}`;
            valaszInput.value = opcio.id;
            valaszInput.dataset.kerdesId = kerdes.id;

            const szoveg = document.createElement('span');
            szoveg.textContent = opcio.szoveg;
            cimke.append(valaszInput, szoveg);
            blokk.append(cimke);
        }

        beadasForm.append(blokk);
    }

    const beadasGomb = document.createElement('button');
    beadasGomb.type = 'submit';
    beadasGomb.textContent = 'Válaszok beadása';
    beadasForm.append(beadasGomb);

    beadasForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const valaszok = {};
        beadasForm.querySelectorAll('input:checked').forEach((input) => {
            const kerdesId = input.dataset.kerdesId;
            (valaszok[kerdesId] ??= []).push(Number(input.value));
        });

        beadasGomb.disabled = true;
        allapot.dataset.hiba = 'false';
        allapot.textContent = 'A válaszok beküldése folyamatban…';

        try {
            const eredmeny = await apiKerdes(
                `/api/kitoltes/${encodeURIComponent(kitoltesToken)}/beadas`,
                { valaszok },
            );

            if (!eredmeny.sikeres) {
                allapot.dataset.hiba = 'true';
                allapot.textContent = eredmeny.hiba || 'A válaszok beadása nem sikerült.';

                if (eredmeny.lezarva || eredmeny.status === 409) {
                    if (aktivKitoltes?.token === kitoltesToken) aktivKitoltes.beadva = true;
                    visszaszamlaloLeallitasa();
                    beadasForm.querySelectorAll('input').forEach((input) => { input.disabled = true; });
                    beadasGomb.remove();
                } else {
                    beadasGomb.disabled = false;
                }
                return;
            }

            allapot.textContent = `Eredmény: ${eredmeny.pont} / ${eredmeny.max} pont. Kitöltési idő: ${eredmeny.eltelt_mp} másodperc.`;
            if (aktivKitoltes?.token === kitoltesToken) aktivKitoltes.beadva = true;
            visszaszamlaloLeallitasa();
            beadasForm.querySelectorAll('input').forEach((input) => { input.disabled = true; });
            beadasGomb.remove();
            eredmenyMegjelenitese(eredmeny.eredmeny);
        } catch {
            allapot.dataset.hiba = 'true';
            allapot.textContent = 'Nem sikerült kapcsolódni a szerverhez.';
            beadasGomb.disabled = false;
        }
    });

    kvizTerulet.append(beadasForm);
    kvizTerulet.hidden = false;
}

inditasForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    kvizTerulet.hidden = true;
    visszaszamlaloLeallitasa();
    visszaszamlalo.hidden = true;
    idoFolyamat.style.width = '100%';
    allapot.dataset.hiba = 'false';
    allapot.textContent = 'A kvíz indítása folyamatban…';
    inditGomb.disabled = true;

    try {
        const eredmeny = await apiKerdes('/api/kviz/1/kitoltes', {});
        if (!eredmeny.sikeres) {
            if (Number.isInteger(eredmeny.probalkozasok)) {
                probalkozasElem.textContent = `Próbálkozás: ${eredmeny.probalkozasok}/${eredmeny.max_probalkozas}`;
            }
            allapot.dataset.hiba = 'true';
            allapot.textContent = eredmeny.hiba || 'A kvíz indítása nem sikerült.';
            return;
        }

        probalkozasElem.textContent = `Próbálkozás: ${eredmeny.probalkozas}/${eredmeny.max_probalkozas}`;
        utolsoInditasValasz = { ...eredmeny };
        aktivKitoltes = {
            token: eredmeny.kitoltes,
            kerdesek: eredmeny.kerdesek,
            beadva: false,
        };
        allapot.textContent = `A kitöltés elindult. Időkorlát: ${eredmeny.idokorlat_mp} másodperc.`;
        visszaszamlaloInditasa(
            eredmeny.szerver_ido_ms,
            eredmeny.hatarido_ms,
            eredmeny.turelem_mp,
        );
        kerdesekMegjelenitese(eredmeny.kerdesek, eredmeny.kitoltes);
    } catch {
        allapot.dataset.hiba = 'true';
        allapot.textContent = 'Nem sikerült kapcsolódni a szerverhez.';
    } finally {
        inditGomb.disabled = false;
    }
});

naploTorlese.addEventListener('click', () => {
    naplo.replaceChildren(uresNaploUzenet());
});

function jsonTartalmazKulcsot(adat, keresettKulcs) {
    if (Array.isArray(adat)) return adat.some((elem) => jsonTartalmazKulcsot(elem, keresettKulcs));
    if (adat === null || typeof adat !== 'object') return false;
    return Object.entries(adat).some(([kulcs, ertek]) => (
        kulcs === keresettKulcs || jsonTartalmazKulcsot(ertek, keresettKulcs)
    ));
}

function tamadasUzenet(mezo, szoveg, allapot = '') {
    mezo.textContent = szoveg;
    if (allapot) mezo.dataset.allapot = allapot;
    else delete mezo.dataset.allapot;
}

function tamadasLezarjaKitoltest() {
    if (aktivKitoltes !== null) aktivKitoltes.beadva = true;
    visszaszamlaloLeallitasa();
    visszaszamlalo.textContent = 'Lezárva';
    visszaszamlalo.setAttribute('aria-label', 'A kitöltés lezárult.');

    const form = document.getElementById('beadas');
    if (form) {
        form.querySelectorAll('input').forEach((input) => { input.disabled = true; });
        form.querySelector('button[type="submit"]')?.remove();
    }

    allapot.dataset.hiba = 'false';
    allapot.textContent = 'A biztonsági próba lezárta az aktív kitöltést.';
}

function beadasiUrl(token) {
    return `/api/kitoltes/${encodeURIComponent(token)}/beadas`;
}

tamadasok.addEventListener('click', async (event) => {
    const gomb = event.target.closest('button[data-tamadas]');
    if (!gomb) return;

    const kartya = gomb.closest('.attack-card');
    const eredmenyMezo = kartya.querySelector('[data-eredmeny]');
    const tamadas = gomb.dataset.tamadas;

    if (tamadas === 'devtools') {
        if (utolsoInditasValasz === null) {
            tamadasUzenet(eredmenyMezo, 'Először indíts kvízt, hogy legyen vizsgálható API-válasz.');
            return;
        }

        if (jsonTartalmazKulcsot(utolsoInditasValasz, 'helyes')) {
            tamadasUzenet(eredmenyMezo, 'Hiba: a helyes mező megjelent az indítás válaszában.', 'hiba');
        } else {
            tamadasUzenet(eredmenyMezo, 'Védve: az indítás JSON-válaszában nincs „helyes” mező. Nézd meg a jobb oldali naplót is.', 'vedve');
        }
        return;
    }

    if (aktivKitoltes === null) {
        tamadasUzenet(eredmenyMezo, 'Először indíts kvízt. A támadási próba az aktív kitöltést használja.');
        return;
    }

    if (aktivKitoltes.beadva && tamadas !== 'dupla-beadas') {
        tamadasUzenet(eredmenyMezo, 'Ez a kitöltés már lezárult. Indíts újat a próba futtatásához.');
        return;
    }

    gomb.disabled = true;
    tamadasUzenet(eredmenyMezo, 'Támadási próba futtatása…');
    const url = beadasiUrl(aktivKitoltes.token);

    try {
        if (tamadas === 'idegen-opcio') {
            const elsoKerdes = aktivKitoltes.kerdesek[0];
            const valasz = await apiKerdes(url, {
                valaszok: { [elsoKerdes.id]: [99] },
            });

            if (valasz.status === 422) {
                tamadasUzenet(eredmenyMezo, 'Védve: a szerver 422-vel elutasította a nem létező opcióazonosítót.', 'vedve');
                if (valasz.lezarva) tamadasLezarjaKitoltest();
            } else {
                tamadasUzenet(eredmenyMezo, `Váratlan válasz: HTTP ${valasz.status}. Nézd meg a szerverellenőrzést.`, 'hiba');
            }
        } else if (tamadas === 'minden-opcio') {
            const mindenValasz = Object.fromEntries(
                aktivKitoltes.kerdesek.map((kerdes) => [
                    kerdes.id,
                    kerdes.opciok.map((opcio) => opcio.id),
                ])
            );
            const valasz = await apiKerdes(url, { valaszok: mindenValasz });

            if (valasz.status === 422 && !valasz.lezarva) {
                tamadasUzenet(eredmenyMezo, `Védve: a teljes opciólista HTTP 422 választ kapott. ${valasz.hiba || ''}`.trim(), 'vedve');
            } else if (valasz.status === 200) {
                tamadasLezarjaKitoltest();
                tamadasUzenet(
                    eredmenyMezo,
                    'Hiba: a szerver elfogadta a teljes opciólistát HTTP 200 válasszal a várt 422 helyett.',
                    'hiba',
                );
            } else {
                if (valasz.lezarva) tamadasLezarjaKitoltest();
                tamadasUzenet(eredmenyMezo, `A próba HTTP ${valasz.status} választ kapott: ${valasz.hiba || 'ellenőrizd a naplót.'}`, valasz.status >= 400 ? 'hiba' : '');
            }
        } else if (tamadas === 'dupla-beadas') {
            if (aktivKitoltes.beadva) {
                const ismelt = await apiKerdes(url, { valaszok: {} });
                tamadasUzenet(
                    eredmenyMezo,
                    ismelt.status === 409
                        ? 'Védve: a már lezárt kitöltés ismételt beadása HTTP 409 választ kapott.'
                        : `A megismételt kérés HTTP ${ismelt.status} választ kapott.`,
                    ismelt.status === 409 ? 'vedve' : 'hiba',
                );
            } else {
                const elso = await apiKerdes(url, { valaszok: {} });
                if (elso.status === 200 || elso.lezarva) tamadasLezarjaKitoltest();
                const masodik = await apiKerdes(url, { valaszok: {} });

                if (elso.status === 200 && masodik.status === 409) {
                    tamadasUzenet(eredmenyMezo, 'Védve: az első beadás HTTP 200, a párhuzamosan ismételt beadás HTTP 409 választ kapott.', 'vedve');
                } else {
                    tamadasUzenet(eredmenyMezo, `Első válasz: HTTP ${elso.status}; ismételt válasz: HTTP ${masodik.status}.`, 'hiba');
                }
            }
        } else if (tamadas === 'hamis-ido') {
            const valasz = await apiKerdes(url, {
                valaszok: {},
                eltelt_mp: 360,
                kezdes: '2000-01-01 00:00:00',
            });

            if (valasz.status === 200) {
                tamadasLezarjaKitoltest();
                tamadasUzenet(
                    eredmenyMezo,
                    `Védve: a beküldött 360 mp helyett a szerver a saját órája szerint ${valasz.eltelt_mp} mp-et számolt.`,
                    'vedve',
                );
            } else if (valasz.status === 422) {
                if (valasz.lezarva) tamadasLezarjaKitoltest();
                tamadasUzenet(eredmenyMezo, 'A szerver a saját kezdési idő alapján lejártnak találta a kitöltést (HTTP 422).', 'vedve');
            } else {
                tamadasUzenet(eredmenyMezo, `A próba HTTP ${valasz.status} választ kapott: ${valasz.hiba || 'ellenőrizd a naplót.'}`, 'hiba');
            }
        }
    } catch {
        tamadasUzenet(eredmenyMezo, 'Nem sikerült kapcsolódni a szerverhez.', 'hiba');
    } finally {
        gomb.disabled = false;
    }
});

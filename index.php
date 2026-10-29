<?php
declare(strict_types=1);

$csrf = htmlspecialchars((string) ($_SESSION['csrf'] ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
?>
<!doctype html>
<html lang="hu">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="<?= $csrf ?>">
    <meta name="theme-color" content="#f3f6fa">
    <title>Webfejlesztés – gyakorló kvíz</title>
    <link rel="stylesheet" href="/assets/app.css">
    <script src="/assets/app.js" defer></script>
</head>
<body>
<main class="app-shell">
    <header class="app-header">
        <div class="app-mark" aria-hidden="true">KV</div>
        <div class="app-heading">
            <p class="eyebrow">Webfejlesztés · PHP és SQLite</p>
            <h1>Gyakorló kvíz</h1>
        </div>
        <span class="api-badge">Szerveroldali pontozás</span>
    </header>

    <div class="app-layout">
        <section class="client-panel" aria-labelledby="client-title">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">Kliensnézet</p>
                    <h2 id="client-title">Webfejlesztés – gyakorló ZH</h2>
                </div>
            </div>

            <form id="inditas">
                <button id="indit-gomb" type="submit"><span aria-hidden="true">▶</span> Kitöltés indítása</button>
                <div class="timer-area">
                    <p id="visszaszamlalo" aria-live="off" hidden></p>
                    <p id="probalkozas" class="attempt-count">Próbálkozás: –/–</p>
                </div>
                <div class="progress-track" aria-hidden="true"><span id="ido-folyamat"></span></div>
            </form>

            <p id="allapot" role="status" aria-live="polite">Indítsd el a kitöltést a kérdések betöltéséhez.</p>
            <section id="kviz" aria-label="Kvízkérdések" hidden></section>

            <section class="attack-panel" aria-labelledby="tamadas-cim">
                <div class="attack-heading">
                    <div>
                        <p class="eyebrow">Biztonsági próba</p>
                        <h2 id="tamadas-cim">Csaló hallgató eszköztára</h2>
                        <p class="attack-intro">Futtasd a támadásmintákat az aktív kitöltésen, és nézd meg a jobb oldali naplóban a valódi API-választ.</p>
                    </div>
                </div>

                <div id="tamadasok" class="attack-grid">
                    <article class="attack-card">
                        <div class="attack-card-heading"><span class="attack-icon" aria-hidden="true">🔍</span><h3>DevTools: „helyes” keresése a válaszban</h3></div>
                        <p>Vizsgáld meg az indításkor kapott JSON-t. A kliens csak kérdés- és opcióadatokat kaphat.</p>
                        <pre>Network → kitoltes → Response → keresés: "helyes"</pre>
                        <button type="button" class="attack-button" data-tamadas="devtools">Válasz ellenőrzése</button>
                        <p class="attack-result" data-eredmeny role="status">Indíts kvízt, majd ellenőrizd a választ.</p>
                    </article>

                    <article class="attack-card">
                        <div class="attack-card-heading"><span class="attack-icon" aria-hidden="true">☑</span><h3>Minden opció beküldése</h3></div>
                        <p>Az összes opció egyszerre történő beküldését a szerver 422-vel elutasítja.</p>
                        <pre>{"valaszok":{"1":[1,2,3,4]}}</pre>
                        <button type="button" class="attack-button" data-tamadas="minden-opcio">Minden opció beküldése</button>
                        <p class="attack-result" data-eredmeny role="status">Aktív kitöltés szükséges; a beadás lezárja azt.</p>
                    </article>

                    <article class="attack-card">
                        <div class="attack-card-heading"><span class="attack-icon" aria-hidden="true">↗</span><h3>Idegen opció-azonosító (99)</h3></div>
                        <p>Küldj be egy olyan opcióazonosítót, amely nem tartozik a kérdéshez. A szervernek ezt el kell utasítania.</p>
                        <pre>{"valaszok":{"1":[99]}}</pre>
                        <button type="button" class="attack-button" data-tamadas="idegen-opcio">99-es opció próbája</button>
                        <p class="attack-result" data-eredmeny role="status">Aktív kitöltés szükséges; a 422-es válasz nem zárja le.</p>
                    </article>

                    <article class="attack-card">
                        <div class="attack-card-heading"><span class="attack-icon" aria-hidden="true">⟲</span><h3>Dupla beadás</h3></div>
                        <p>Küldd el kétszer egymás után ugyanazt a kitöltést. Az atomi lezárás csak az első beadást engedi át.</p>
                        <pre>POST /beadas → ismételt POST /beadas</pre>
                        <button type="button" class="attack-button" data-tamadas="dupla-beadas">Dupla beadás indítása</button>
                        <p class="attack-result" data-eredmeny role="status">Aktív kitöltés szükséges; a próba lezárja azt.</p>
                    </article>

                    <article class="attack-card">
                        <div class="attack-card-heading"><span class="attack-icon" aria-hidden="true">⏩</span><h3>Óra +6 perc</h3></div>
                        <p>Próbálj hamis eltelt időt és kezdési időt küldeni. A szerver a saját adatbázisában tárolt kezdést ellenőrzi.</p>
                        <pre>{"eltelt_mp":360,"kezdes":"2000-01-01 00:00:00"}</pre>
                        <button type="button" class="attack-button" data-tamadas="hamis-ido">Hamis idő beküldése</button>
                        <p class="attack-result" data-eredmeny role="status">Aktív kitöltés szükséges; a próba lezárja azt.</p>
                    </article>
                </div>
            </section>
        </section>

        <aside class="network-panel" aria-labelledby="naplo-title">
            <div class="network-header">
                <div>
                    <p class="eyebrow">API-forgalom</p>
                    <h2 id="naplo-title">Kérések és válaszok</h2>
                </div>
                <button id="naplo-torlese" class="button-secondary" type="button">Napló törlése</button>
            </div>
            <p class="network-hint">Görgess a naplóban a korábbi kérésekhez; a hosszú JSON-blokkok külön is görgethetők.</p>
            <div id="naplo" class="network-log" role="log" aria-live="polite">
                <p class="log-empty">Indítsd el a kvízt a forgalom megtekintéséhez.</p>
            </div>
        </aside>
    </div>

</main>
</body>
</html>

<?php
declare(strict_types=1);

const TURELEM_MP = 10;

$ut = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$ut = is_string($ut) ? $ut : '/';
$mod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($mod === 'GET' && in_array($ut, ['/assets/app.css', '/assets/app.js'], true)) {
    return false;
}

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$_SESSION['uid'] ??= bin2hex(random_bytes(8));

$pdo = new PDO('sqlite:' . __DIR__ . '/kviz.db', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON');
$pdo->exec('PRAGMA busy_timeout = 5000');

if (!$pdo->query("SELECT name FROM sqlite_master WHERE name = 'kvizek'")->fetch()) {
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    if ($schema === false) {
        throw new RuntimeException('A sémafájl nem olvasható.');
    }

    $pdo->exec($schema);
}

function valasz(int $status, ?array $adat = null, array $fejlecek = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');

    foreach ($fejlecek as $nev => $ertek) {
        header($nev . ': ' . $ertek);
    }

    if ($adat !== null) {
        echo json_encode($adat, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    }

    exit;
}

/** CSRF token, torzset olvas */
function bemenet(): array
{
    $csrf = (string) ($_SESSION['csrf'] ?? '');
    $kapottToken = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

    if ($csrf === '' || !hash_equals($csrf, $kapottToken)) {
        valasz(403, ['hiba' => 'Érvénytelen CSRF token']);
    }

    $nyers = file_get_contents('php://input');
    if ($nyers === false || $nyers === '') {
        return [];
    }

    $adat = json_decode($nyers, true);
    if (!is_array($adat)) {
        valasz(400, ['hiba' => 'Hibás JSON']);
    }

    return $adat;
}

if ($mod === 'GET' && $ut === '/') {
    require __DIR__ . '/index.php';
    exit;
}

if ($mod === 'POST' && preg_match('#^/api/kviz/(\d+)/kitoltes$#', $ut, $utvonal) === 1) {
    bemenet();
    $kvizId = (int) $utvonal[1];

    $pdo->exec('BEGIN IMMEDIATE TRANSACTION');

    try {
        $lekerdezes = $pdo->prepare(
            'SELECT id, cim, idokorlat_mp, max_probalkozas FROM kvizek WHERE id = ?'
        );
        $lekerdezes->execute([$kvizId]);
        $kviz = $lekerdezes->fetch();

        if ($kviz === false) {
            $pdo->exec('COMMIT');
            valasz(404, ['hiba' => 'Nincs ilyen kvíz']);
        }

        $lekerdezes = $pdo->prepare(
            'SELECT COUNT(*) FROM kitoltesek WHERE kviz_id = ? AND felhasznalo = ?'
        );
        $lekerdezes->execute([$kvizId, $_SESSION['uid']]);
        $probalkozasok = (int) $lekerdezes->fetchColumn();
        $maxProbalkozas = (int) $kviz['max_probalkozas'];

        if ($probalkozasok >= $maxProbalkozas) {
            $pdo->exec('COMMIT');
            valasz(403, [
                'hiba' => 'Elfogytak a próbálkozásaid (' . $maxProbalkozas . ')',
                'probalkozasok' => $probalkozasok,
                'max_probalkozas' => $maxProbalkozas,
            ]);
        }

        $token = bin2hex(random_bytes(16));
        $kezdesUnix = time();
        $kezdes = gmdate('Y-m-d H:i:s', $kezdesUnix);
        $lekerdezes = $pdo->prepare(
            'INSERT INTO kitoltesek (token, kviz_id, felhasznalo, kezdes) VALUES (?, ?, ?, ?)'
        );
        $lekerdezes->execute([$token, $kvizId, $_SESSION['uid'], $kezdes]);

        // a helyes oszlop nem szerepel egy inditas kereseben sem
        $lekerdezes = $pdo->prepare(
            'SELECT id, szoveg, pont, tobbszoros FROM kerdesek WHERE kviz_id = ? ORDER BY sorrend'
        );
        $lekerdezes->execute([$kvizId]);
        $kerdesek = [];
        $opcioLekerdezes = $pdo->prepare(
            'SELECT id, szoveg FROM opciok WHERE kerdes_id = ?'
        );

        foreach ($lekerdezes->fetchAll() as $kerdes) {
            $opcioLekerdezes->execute([$kerdes['id']]);
            $opciok = $opcioLekerdezes->fetchAll();
            shuffle($opciok);

            $kerdesek[] = [
                'id' => (int) $kerdes['id'],
                'szoveg' => (string) $kerdes['szoveg'],
                'pont' => (int) $kerdes['pont'],
                'tobbszoros' => (bool) (int) $kerdes['tobbszoros'],
                'opciok' => array_map(
                    static fn (array $opcio): array => [
                        'id' => (int) $opcio['id'],
                        'szoveg' => (string) $opcio['szoveg'],
                    ],
                    $opciok
                ),
            ];
        }

        $pdo->exec('COMMIT');
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->exec('ROLLBACK');
        }

        throw $error;
    }

    $szerverIdoMs = (int) floor(microtime(true) * 1000);
    $hataridoMs = ($kezdesUnix + (int) $kviz['idokorlat_mp'] + TURELEM_MP) * 1000;

    valasz(201, [
        'kitoltes' => $token,
        'cim' => (string) $kviz['cim'],
        'idokorlat_mp' => (int) $kviz['idokorlat_mp'],
        'turelem_mp' => TURELEM_MP,
        'probalkozas' => $probalkozasok + 1,
        'max_probalkozas' => $maxProbalkozas,
        'szerver_ido_ms' => $szerverIdoMs,
        'hatarido_ms' => $hataridoMs,
        'kerdesek' => $kerdesek,
    ], ['Location' => '/api/kitoltes/' . $token]);
}

if ($mod === 'POST' && preg_match('#^/api/kitoltes/([a-f0-9]{32})/beadas$#', $ut, $utvonal) === 1) {
    $adat = bemenet();
    $token = $utvonal[1];

    $lekerdezes = $pdo->prepare(
        'SELECT kt.id, kt.kviz_id, kt.felhasznalo, kt.kezdes, kt.beadva, '
        . 'kv.idokorlat_mp FROM kitoltesek kt '
        . 'JOIN kvizek kv ON kv.id = kt.kviz_id WHERE kt.token = ?'
    );
    $lekerdezes->execute([$token]);
    $kitoltes = $lekerdezes->fetch();

    if ($kitoltes === false) {
        valasz(404, ['hiba' => 'Nincs ilyen kitöltés']);
    }

    if (!hash_equals((string) $kitoltes['felhasznalo'], (string) $_SESSION['uid'])) {
        valasz(403, ['hiba' => 'Nem a te kitöltésed']);
    }

    if ($kitoltes['beadva'] !== null) {
        valasz(409, ['hiba' => 'Ezt a kitöltést már beadtad']);
    }

    $kezdesIdo = strtotime((string) $kitoltes['kezdes'] . ' UTC');
    if ($kezdesIdo === false) {
        valasz(500, ['hiba' => 'A kitöltés kezdési ideje nem olvasható.']);
    }

    $elteltMp = time() - $kezdesIdo;
    $idoKorlatMp = (int) $kitoltes['idokorlat_mp'];
    if ($elteltMp > $idoKorlatMp + TURELEM_MP) {
        $pdo->exec('BEGIN IMMEDIATE TRANSACTION');

        try {
            $lezaras = $pdo->prepare(
                'UPDATE kitoltesek SET beadva = ?, pont = 0 WHERE id = ? AND beadva IS NULL'
            );
            $lezaras->execute([gmdate('Y-m-d H:i:s'), $kitoltes['id']]);

            if ($lezaras->rowCount() !== 1) {
                $pdo->exec('ROLLBACK');
                valasz(409, ['hiba' => 'Ezt a kitöltést már beadtad']);
            }

            $pdo->exec('COMMIT');
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->exec('ROLLBACK');
            }

            throw $error;
        }

        valasz(422, [
            'hiba' => 'Lejárt az idő; a kitöltés 0 ponttal lezárva.',
            'pont' => 0,
            'lezarva' => true,
        ]);
    }

    if (!array_key_exists('valaszok', $adat) || !is_array($adat['valaszok'])) {
        valasz(422, ['hiba' => 'A válaszok mező kötelező, és kérdésenkénti opcióazonosítókat kell tartalmaznia.']);
    }
    $valaszok = $adat['valaszok'];

    $lekerdezes = $pdo->prepare(
        'SELECT id, pont FROM kerdesek WHERE kviz_id = ? ORDER BY sorrend'
    );
    $lekerdezes->execute([$kitoltes['kviz_id']]);
    $ervenyes = [];
    $helyes = [];
    $pontok = [];

    foreach ($lekerdezes->fetchAll() as $kerdes) {
        $kerdesId = (int) $kerdes['id'];
        $ervenyes[$kerdesId] = [];
        $helyes[$kerdesId] = [];
        $pontok[$kerdesId] = (int) $kerdes['pont'];
    }

    $lekerdezes = $pdo->prepare(
        'SELECT o.id, o.kerdes_id, o.helyes FROM opciok o '
        . 'JOIN kerdesek k ON k.id = o.kerdes_id WHERE k.kviz_id = ?'
    );
    $lekerdezes->execute([$kitoltes['kviz_id']]);

    foreach ($lekerdezes->fetchAll() as $opcio) {
        $kerdesId = (int) $opcio['kerdes_id'];
        $opcioId = (int) $opcio['id'];
        $ervenyes[$kerdesId][] = $opcioId;
        if ((int) $opcio['helyes'] === 1) {
            $helyes[$kerdesId][] = $opcioId;
        }
    }

    foreach ($valaszok as $kerdesKulcs => $_) {
        if (is_int($kerdesKulcs)) {
            $kerdesId = $kerdesKulcs;
        } elseif (is_string($kerdesKulcs) && preg_match('/^[1-9][0-9]*$/D', $kerdesKulcs) === 1) {
            $kerdesId = (int) $kerdesKulcs;
        } else {
            valasz(422, ['hiba' => 'Érvénytelen kérdésazonosító a válaszok között.']);
        }

        if ($kerdesId < 1 || !array_key_exists($kerdesId, $pontok)) {
            valasz(422, ['hiba' => 'A válaszok nem ehhez a kvízhez tartozó kérdést tartalmaznak.']);
        }
    }

    $osszesPont = 0;
    $eredmenyek = [];
    $mentendoValaszok = [];

    foreach ($pontok as $kerdesId => $kerdesPont) {
        $kivalasztott = array_key_exists($kerdesId, $valaszok)
            ? $valaszok[$kerdesId]
            : [];
        if (!is_array($kivalasztott)) {
            valasz(422, ['hiba' => 'Egy kérdés válaszának opcióazonosítók listájának kell lennie.']);
        }

        foreach (array_keys($kivalasztott) as $index => $kulcs) {
            if ($kulcs !== $index) {
                valasz(422, ['hiba' => 'Egy kérdés válaszának rendezett opcióazonosító-listának kell lennie.']);
            }
        }

        $opcioIdk = [];
        foreach ($kivalasztott as $opcioId) {
            if (is_int($opcioId)) {
                $azonosito = $opcioId;
            } elseif (is_string($opcioId) && preg_match('/^[0-9]+$/D', $opcioId) === 1) {
                $azonosito = (int) $opcioId;
            } else {
                valasz(422, ['hiba' => 'A válasz csak érvényes opcióazonosítókat tartalmazhat.']);
            }

            if ($azonosito < 1) {
                valasz(422, ['hiba' => 'A válasz csak pozitív opcióazonosítókat tartalmazhat.']);
            }
            $opcioIdk[] = $azonosito;
        }

        $opcioIdk = array_values(array_unique($opcioIdk));
        if (array_diff($opcioIdk, $ervenyes[$kerdesId]) !== []) {
            valasz(422, ['hiba' => 'Érvénytelen opció a(z) ' . $kerdesId . '. kérdésnél.']);
        }

        // A teljes opciólista beküldése külön hibás kérésként kezelendő.
        // Ez a biztonsági próba 422-vel tér vissza, nem egyszerűen nulla ponttal.
        $osszesOpcion = $ervenyes[$kerdesId];
        $bekuldottHalmaz = $opcioIdk;
        sort($osszesOpcion, SORT_NUMERIC);
        sort($bekuldottHalmaz, SORT_NUMERIC);
        if ($osszesOpcion !== [] && $bekuldottHalmaz === $osszesOpcion) {
            valasz(422, ['hiba' => 'Egy kérdéshez nem küldhető be az összes opció. 0 pont.']);
        }

        $helyesIdk = $helyes[$kerdesId];
        sort($opcioIdk, SORT_NUMERIC);
        sort($helyesIdk, SORT_NUMERIC);
        $helyesValasz = $opcioIdk === $helyesIdk;
        $kapottPont = $helyesValasz ? $kerdesPont : 0;
        $osszesPont += $kapottPont;

        $eredmenyek[] = [
            'kerdes_id' => $kerdesId,
            'helyes' => $helyesValasz,
            'pont' => $kapottPont,
            'max' => $kerdesPont,
        ];

        foreach ($opcioIdk as $opcioId) {
            $mentendoValaszok[] = [$kitoltes['id'], $kerdesId, $opcioId];
        }
    }

    $pdo->exec('BEGIN IMMEDIATE TRANSACTION');
    try {
        $lezaras = $pdo->prepare(
            'UPDATE kitoltesek SET beadva = ?, pont = ? WHERE id = ? AND beadva IS NULL'
        );
        $lezaras->execute([gmdate('Y-m-d H:i:s'), $osszesPont, $kitoltes['id']]);

        if ($lezaras->rowCount() !== 1) {
            $pdo->exec('ROLLBACK');
            valasz(409, ['hiba' => 'Ezt a kitöltést már beadtad']);
        }

        $mentes = $pdo->prepare(
            'INSERT INTO valaszok (kitoltes_id, kerdes_id, opcio_id) VALUES (?, ?, ?)'
        );
        foreach ($mentendoValaszok as $valaszSor) {
            $mentes->execute($valaszSor);
        }

        $pdo->exec('COMMIT');
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->exec('ROLLBACK');
        }

        throw $error;
    }

    valasz(200, [
        'pont' => $osszesPont,
        'max' => array_sum($pontok),
        'eltelt_mp' => $elteltMp,
        'eredmeny' => $eredmenyek,
    ]);
}

valasz(404, ['hiba' => 'Nincs ilyen végpont']);

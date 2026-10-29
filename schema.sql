CREATE TABLE IF NOT EXISTS kvizek (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cim VARCHAR(120) NOT NULL,
    idokorlat_mp INTEGER NOT NULL DEFAULT 120,
    max_probalkozas INTEGER NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS kerdesek (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kviz_id INTEGER NOT NULL REFERENCES kvizek(id),
    sorrend INTEGER NOT NULL DEFAULT 0,
    szoveg VARCHAR(300) NOT NULL,
    pont INTEGER NOT NULL DEFAULT 1,
    tobbszoros INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS opciok (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kerdes_id INTEGER NOT NULL REFERENCES kerdesek(id),
    szoveg VARCHAR(200) NOT NULL,
    helyes INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kitoltesek (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token CHAR(32) NOT NULL UNIQUE,
    kviz_id INTEGER NOT NULL REFERENCES kvizek(id),
    felhasznalo VARCHAR(64) NOT NULL,
    kezdes DATETIME NOT NULL,
    beadva DATETIME NULL,
    pont INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_kitoltesek_felh
    ON kitoltesek (kviz_id, felhasznalo);

CREATE TABLE IF NOT EXISTS valaszok (
    kitoltes_id INTEGER NOT NULL REFERENCES kitoltesek(id),
    kerdes_id INTEGER NOT NULL REFERENCES kerdesek(id),
    opcio_id INTEGER NOT NULL REFERENCES opciok(id),
    PRIMARY KEY (kitoltes_id, kerdes_id, opcio_id)
);

INSERT INTO kvizek (id, cim, idokorlat_mp, max_probalkozas)
VALUES (1, 'Webfejlesztés – gyakorló ZH', 120, 3);

INSERT INTO kerdesek (id, kviz_id, sorrend, szoveg, pont, tobbszoros) VALUES
    (1, 1, 1, 'Melyik státuszkód jelenti, hogy az erőforrás létrejött?', 1, 0),
    (2, 1, 2, 'Melyik PHP függvény véd a tárolt XSS ellen kiíráskor?', 1, 0),
    (3, 1, 3, 'Mely állítások igazak a prepared statementre?', 2, 1),
    (4, 1, 4, 'Hol kell kiszámolni a kvíz pontszámát?', 1, 0);

INSERT INTO opciok (id, kerdes_id, szoveg, helyes) VALUES
    (1, 1, '200 OK', 0),
    (2, 1, '201 Created', 1),
    (3, 1, '204 No Content', 0),
    (4, 1, '302 Found', 0),
    (5, 2, 'htmlspecialchars()', 1),
    (6, 2, 'addslashes()', 0),
    (7, 2, 'md5()', 0),
    (8, 2, 'trim()', 0),
    (9, 3, 'Az SQL és az adat külön utazik a szerverhez', 1),
    (10, 3, 'Automatikusan titkosítja a jelszavakat', 0),
    (11, 3, 'Megvéd az SQL injection ellen', 1),
    (12, 3, 'Csak MySQL-lel működik', 0),
    (13, 4, 'A kliensen, JavaScriptben', 0),
    (14, 4, 'A szerveren', 1),
    (15, 4, 'A localStorage-ban', 0);

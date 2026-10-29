# Webfejlesztés – gyakorló ZH

Szerveroldalon pontozott, PHP 8 és SQLite alapú gyakorló kvíz.

## Indítás

PHP 8 és a `PDO_SQLite` bővítmény szükséges. A projekt könyvtárában futtasd:

php -S localhost:8000 api.php

Ezután nyisd meg a localhost:8000 oldalt, ez létrehozza az sqlite adatbázist.

## API

- `POST /api/kviz/1/kitoltes` – új próbálkozás indítása. A CSRF-token a kezdőoldal `csrf-token` metaeleméből olvasható ki, és az `X-CSRF-Token` fejlécben kell elküldeni.
- `POST /api/kitoltes/{token}/beadas` – beadás. A törzs `valaszok` mezője kérdésazonosítónként a kiválasztott opcióazonosítók listáját tartalmazza.

A pontszámot és az időkorlátot a szerver ellenőrzi. A visszaszámláló a szerver által küldött határidőt jeleníti meg; a beadás elfogadásáról mindig a szerver dönt. A helyes opciók nem szerepelnek az indítás válaszában.

A felület két panelből áll: bal oldalon a kitöltői nézet és a biztonsági próba, jobb oldalon az aktuális HTTP-kérés és -válasz naplója. A jobb oldali napló a görgetésével megőrzi és elérhetővé teszi a régebbi kéréseket; a hosszú JSON-törzsek külön is görgethetők. A napló a tényleges válasz státuszát és kiválasztott fejléceit mutatja, a JSON-törzsből pedig a kvízadatokat vagy a beadás eredményét emeli ki. A szerveroldali SQL-lépések magyarázó jelleggel jelennek meg.

## Biztonsági próbák

A bal oldali kvízpanelen lévő **Csaló hallgató eszköztára** a valódi API-n próbálja ki az opciók kiszivárgását, az összes opció beküldését, az idegen opcióazonosítót, a dupla beadást és a hamis kliensidőt. Előbb indíts kvízt. Az összes opció és az idegen opció próbája 422 választ kap, és normál esetben nem zárja le a kitöltést; a dupla beadás és a hamis idő próbája lezárja az aktív kitöltést.

## Megjegyzés a felhasználóhoz

A példában a munkamenet véletlenszerű `uid`-t kap, mert nincs beépített bejelentkezés. Éles használathoz ezt a bejelentkezett felhasználó azonosítójával kell összekötni.

# IT-Grundlagen — Lernapp

Statische Lernapp: HTML, CSS, ein JS-File, eine JSON-Datei. Kein Build, keine Abhängigkeiten,
kein Backend. Lernstand liegt in `localStorage` des Browsers.

```
index.html      Seitengerüst und Selbstportrait
style.css       Token-Set oben in :root, dort Farben anpassen
app.js          Router, Leitner-Logik, Antwortprüfung, Export
content.json    Alle Inhalte und Fragen — die einzige Datei, die du zum Lernen pflegst
```

## Lokal ansehen

Nicht per Doppelklick öffnen — `fetch('content.json')` wird von `file://` blockiert.
Im Projektordner:

```bash
python3 -m http.server
```

Dann `http://localhost:8000` aufrufen.

## Auf GitHub Pages stellen

1. Neues Repo anlegen, **public**, die vier Dateien in den Wurzelordner legen.
2. Repo → Settings → Pages → Source: *Deploy from a branch*, Branch `main`, Ordner `/ (root)`.
3. Nach etwa einer Minute liegt die Seite auf `https://<name>.github.io/<repo>/`.

Wichtig: alle Pfade sind **relativ** (`style.css`, nicht `/style.css`). Absolute Pfade brechen,
weil Pages die Seite in einem Unterordner ausliefert.

## Pseudonym bleiben

Das Repo ist öffentlich, und Git verrät mehr als die Website:

- **Commit-Mail:** In jedem Commit steht deine `user.email`. Setz vorher
  `git config user.email "<zahl>+<name>@users.noreply.github.com"` (die Adresse steht in deinen
  GitHub-Mail-Einstellungen) und aktivier dort *Keep my email addresses private*.
- **Profil:** Feld „Name" leer lassen oder Pseudonym, Standort weglassen.
- **Kontakt auf der Seite:** eine Weiterleitungsadresse, keine Adresse, die deinen Namen enthält.
- Bereits gepushte Commits behalten die alte Mail. Bei Bedarf Repo neu anlegen und einmal
  frisch committen, statt Historie umzuschreiben.

Das Selbstportrait sitzt in `index.html` zwischen den beiden Kommentarblöcken
`SELBSTPORTRAIT`. Ersetz Pseudonym, zwei Absätze und die Kontaktzeilen.

## Fragen ergänzen

In `content.json`, im `questions`-Array des Themas. Zwei Typen:

```json
{ "id": 5, "type": "choice", "question": "…",
  "options": ["A", "B", "C", "D"], "answer": ["a"], "explanation": "…" }

{ "id": 6, "type": "text", "question": "…",
  "answer": ["32", "zweiunddreissig"], "explanation": "…" }
```

- `id` muss innerhalb des Themas eindeutig und **stabil** sein — der Lernstand hängt daran.
  Nummern nicht nachträglich vergeben.
- `answer` ist eine Liste erlaubter Antworten. Verglichen wird normalisiert: Kleinschreibung,
  Umlaute, Tausendertrennzeichen und Satzzeichen am Ende sind egal.
- Bei `choice` muss `answer[0]` einer der `options` entsprechen (Gross-/Kleinschreibung egal).

## Leitner-Logik

Jede Frage sitzt in Box 1, 2 oder 3. Richtig beantwortet: eine Box hoch. Falsch: zurück auf 1.
Eine Runde zieht alles aus Box 1, die Hälfte aus Box 2, ein Viertel aus Box 3, maximal
`ROUND_SIZE` Fragen (oben in `app.js`).

## Später ein Backend

`content.json` bleibt die gemeinsame Quelle — Python kann dieselbe Datei lesen. Zum Umstellen
reicht es, `loadProgress`/`saveProgress` in `app.js` gegen `fetch`-Aufrufe zu tauschen.

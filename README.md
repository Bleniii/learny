# IT-Grundlagen — Lernapp

Statische Lernapp mit HTML, CSS und JavaScript. Kein Build, keine Abhängigkeiten,
kein Backend. Der Lernstand liegt im Browser.

```
index.html      Seitengerüst und Selbstportrait
style.css       Farben stehen oben in :root
app.js          Router, Leitner-Logik, Antwortprüfung
content.json    Alle Inhalte und Fragen
```

## Lokal starten

```bash
python3 -m http.server
```

Dann `http://localhost:8000` öffnen. Doppelklick auf `index.html` funktioniert nicht.

## Auf GitHub Pages stellen

Dateien in ein öffentliches Repo, dann Settings → Pages → Branch `main`, Ordner `/ (root)`.
Pfade müssen relativ bleiben (`style.css`, nicht `/style.css`).

## Fragen ergänzen

In `content.json` beim jeweiligen Thema:

```json
{ "id": 5, "type": "choice", "question": "…",
  "options": ["A", "B", "C", "D"], "answer": ["a"], "explanation": "…" }

{ "id": 6, "type": "text", "question": "…",
  "answer": ["32", "zweiunddreissig"], "explanation": "…" }
```

`id` muss im Thema eindeutig und stabil bleiben — der Lernstand hängt daran.
`answer` ist eine Liste erlaubter Antworten.

## Leitner

Jede Frage sitzt in Box 1, 2 oder 3. Richtig: eine Box hoch. Falsch: zurück auf 1.
Eine Runde zieht alles aus Box 1, die Hälfte aus Box 2, ein Viertel aus Box 3.

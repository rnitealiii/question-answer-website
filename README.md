# Question Answer Website

A minimal Flask website backed by SQLite. Visitors ask questions and see a matching answer plus explanation. An admin can import a question bank from CSV/XLSX or add entries manually.

## Features
- Minimal centered public question page
- Answer and explanation result cards
- Smart fuzzy matching using RapidFuzz
- CSV and Excel (.xlsx) database import
- Admin login and protected upload/add/delete pages
- SQLite database created automatically
- Sample CSV template

## Database file format
Create a CSV or Excel sheet with these column headers:

| Question | Answer | Explanation |
|---|---|---|
| What is a verb? | An action or state word. | Verbs describe actions or states. |

`Question` and `Answer` are required. `Explanation` is optional. Common alternatives such as `Prompt`, `Correct Answer`, `Solution`, `Details`, and `Rationale` are also recognized. Uploads add rows; they do not erase existing entries.

## Run locally

Requires Python 3.10 or newer.

### Windows
1. Extract this ZIP.
2. Open Command Prompt in the extracted folder.
3. Create a virtual environment and install dependencies:

   ```bat
   py -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Set admin credentials and run:

   ```bat
   set ADMIN_PASSWORD=choose-a-long-unique-password
   set SECRET_KEY=replace-this-with-a-long-random-secret
   python app.py
   ```

5. Open `http://127.0.0.1:5000` for the public page.
6. Open `http://127.0.0.1:5000/admin/login` to upload and manage your database.

### macOS / Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export ADMIN_PASSWORD='choose-a-long-unique-password'
export SECRET_KEY='replace-this-with-a-long-random-secret'
python app.py
```

Then open `http://127.0.0.1:5000`.

## Before publishing online
- Set a strong `ADMIN_PASSWORD` and a long random `SECRET_KEY` in your hosting provider's environment settings.
- Use HTTPS and a production WSGI server (e.g. Gunicorn); do not use Flask's development server for a public deployment.
- Set secure cookie options and configure rate limiting / CSRF protection before a high-traffic public launch.
- Keep regular backups of `questions.db`.
- Smart matching is approximate. Review the match threshold and test against your own questions. `MATCH_THRESHOLD` defaults to `72` and can be adjusted from the server environment.
- Never store passwords in source code or upload them with your question bank.

## Environment variables
- `ADMIN_PASSWORD`: required for admin login
- `SECRET_KEY`: set a stable random secret in production
- `QA_DATABASE_PATH`: optional custom SQLite database path
- `MATCH_THRESHOLD`: matching score threshold (default `72`)

## Notes
This starter project uses fuzzy text matching, not a generative AI model. It only returns answers stored in your database. If a question is not close enough to a stored question, it returns a no-match message.

# Match Intelligence Pro datasets

The application accepts validated CSV uploads and does not bundle third-party raw datasets into the frontend.

## Candidate sources

- Cricket: https://cricsheet.org/ — review current terms and attribution requirements before redistribution.
- Football results: https://www.football-data.co.uk/ — review usage terms and source attribution requirements.
- Football event data: https://github.com/statsbomb/open-data — use only under its published open-data terms.
- Tennis: https://github.com/JeffSackmann/tennis_atp — review the repository license and usage conditions.

## Import requirements

Imported records must contain date, home_team, away_team, and winner. The application validates dates, participants, sport names, winner values, and duplicate keys before saving.

## Provenance checklist

For every imported dataset, record the source URL, download date, license or terms reviewed, attribution text, transformations applied, and rejected-row count. Historical data is for statistical research; it does not guarantee future outcomes.

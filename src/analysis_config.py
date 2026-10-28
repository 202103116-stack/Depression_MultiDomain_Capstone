"""PHQ-9 threshold and output namespace for the PHQ>=5 reanalysis fork.

PHQ_CUTOFF=5 is primary; PHQ_CUTOFF=10 is a separately rerun sensitivity.
Keep raw data and individual predictions local (data/ is gitignored).
"""
import os

PHQ_CUTOFF = int(os.environ.get('PHQ_CUTOFF', '5'))
if PHQ_CUTOFF not in (5, 10):
    raise ValueError('PHQ_CUTOFF must be 5 (primary) or 10 (sensitivity).')
ANALYSIS_ID = f'phq{PHQ_CUTOFF}'
EXPECTED_OUTCOME_COUNTS = {5: (37030, 194260), 10: (8704, 222586)}[PHQ_CUTOFF]
OUTCOME_LABEL = f'우울 증상 기준 충족(PHQ-9 ≥ {PHQ_CUTOFF})'

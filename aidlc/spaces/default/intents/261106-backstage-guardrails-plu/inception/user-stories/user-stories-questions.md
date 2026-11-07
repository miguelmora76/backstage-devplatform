# User Stories — Questions

## Q1. [Product] Which personas should the stories be written for?

Why we ask: stories need an actor. Earlier answers named service owners and platform engineers as equal primary users.

- A. Two personas: a service owner and a platform engineer
- B. Three personas: those two plus a read-only auditor who only views the audit log
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q2. [Product] How fine-grained should the stories be?

Why we ask: it sets the number of stories and how independently each can be tested.

- A. One story per capability, about 12 stories
- B. Finer: one story per behavior (for example propose, approve, reject, retry), about 25 stories
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q3. [Product] How should the stories be grouped?

Why we ask: it decides the ID groups (`US1.x`, `US2.x`) and the reading order.

- A. By workflow: view, propose, decide, audit, run and deliver
- B. By feature area, following the requirement groups
- C. By persona
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q4. [Product] How should non-functional requirements (speed, accessibility, coverage) appear?

Why we ask: the requirements have seven non-functional items, and each needs a story-level home to be traced.

- A. As acceptance criteria inside the stories they affect
- B. As their own stories, one per non-functional requirement
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Personas: three — a service owner, a platform engineer, and a read-only auditor who only views the audit log (Q1: B)
- Story size: one story per capability, about 12 stories (Q2: A)
- Grouping: by workflow — view, propose, decide, audit, run and deliver (Q3: A)
- Non-functional requirements appear as acceptance criteria inside the stories they affect (Q4: A)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

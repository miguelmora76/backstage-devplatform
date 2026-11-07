# Test data

`default-data-set.json` is the stored copy of the data set the generator produces from the default seed. The repeatability test fails when the generator's output differs from it, so a change to the default data is made on purpose and the copy is updated in the same change:

```
yarn --cwd packages/guardrails-server build
yarn --cwd packages/guardrails-server -s generate > packages/guardrails-server/test-data/default-data-set.json
```

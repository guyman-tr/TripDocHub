# OpenAI API Pricing Research (Dec 2024)

## Relevant Models for TripHub Document Parsing

### GPT-4o (Current best for vision)
- Input: $2.50 / 1M tokens
- Cached Input: $1.25 / 1M tokens
- Output: $10.00 / 1M tokens

### GPT-4o-mini (Cost-effective option)
- Input: $0.15 / 1M tokens
- Cached Input: $0.075 / 1M tokens
- Output: $0.60 / 1M tokens

### GPT-4.1-mini (Newer, similar pricing)
- Input: $0.40 / 1M tokens
- Cached Input: $0.10 / 1M tokens
- Output: $1.60 / 1M tokens

## Cost Estimation for TripHub

### Per Document Parse (assuming ~2000 tokens input, ~500 tokens output)
Using GPT-4o-mini:
- Input: 2000 tokens × $0.15/1M = $0.0003
- Output: 500 tokens × $0.60/1M = $0.0003
- **Total per document: ~$0.0006 (less than 1 cent)**

Using GPT-4o (higher quality):
- Input: 2000 tokens × $2.50/1M = $0.005
- Output: 500 tokens × $10.00/1M = $0.005
- **Total per document: ~$0.01 (1 cent)**

### Monthly Cost Estimates
- 100 documents/month: $0.06 - $1.00
- 1,000 documents/month: $0.60 - $10.00
- 10,000 documents/month: $6.00 - $100.00

## Note on Manus Platform
Manus may have its own pricing structure for AI processing that differs from direct OpenAI API costs. Need to check Manus documentation for actual costs passed to developers.

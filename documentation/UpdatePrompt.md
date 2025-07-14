Based on the information from the **Starfire Co-Development Pitch** PDF, it would be smart to **update the prompts for your Visualization API** to better align with Starfire’s **commercial intelligence focus** and the **last-mile deliverables** they aim to automate.

Here’s a breakdown and suggested updates:

---

## 🔑 Key Takeaways from the Starfire Document Relevant to Prompt Design:

1. **Starfire’s Core Purpose:**

   * Help **pharma commercial teams** analyze disparate datasets and generate **actionable insights** (not just raw data).
   * Replace **static, consultant-driven reports** with **dynamic, real-time outputs** (including slides and scenario models).

2. **Types of Outputs Needed:**

   * Trend identification (e.g., dips in sales, channel performance)
   * Anomaly detection (off-forecast signals)
   * Strategic recommendations (next best action)
   * Visual deliverables: **executive-ready slides** summarizing key insights.

3. **Target Users:**

   * Commercial leadership (EVPs, Heads of Commercial, Corporate Development)
   * Need for concise, decision-focused outputs without technical deep dives.

---

## 📝 Suggested Prompt Update for Visualization API:

### Old Prompt (example):

> "Generate a visualization for the provided data set."

### Improved Prompt Based on Starfire:

> "Analyze the retrieved market performance data and generate an executive-level visualization that highlights:
>
> * Key trends and anomalies (e.g., dips in sales by channel, payor type)
> * Strategic insights and next-best-action recommendations
> * High-level summaries suitable for C-suite decision-makers.
>
> The visualization should be concise, intuitive, and ready to be inserted into a PowerPoint presentation. Use plain language, avoid technical jargon, and emphasize business impact."

---

## 🔄 Specific Improvements You Should Make:

| What to Change              | Suggested Update                                                                 |
| --------------------------- | -------------------------------------------------------------------------------- |
| **Prompt Instruction Tone** | Use **executive-friendly language** (not technical, not verbose)                 |
| **Analysis Focus**          | Guide the LLM to surface **trends, anomalies, and strategic implications**       |
| **Visual Guidance**         | Make clear the output is for **last-mile deliverables** (slides, reports)        |
| **Brevity & Actionability** | Request **short, actionable insights** with optional callouts or recommendations |

---

## Example Prompt for Starfire Visualization API:

```plaintext
“Based on the provided commercial data, generate a concise visual summary identifying:
- The top 3 trends impacting brand performance
- Any anomalies or deviations from forecasted metrics
- Suggested next-best-actions for the commercial team.
”
```

---

👉 This prompt aligns with Starfire’s goals of:

* Fast, iterative insights.
* Decision support (not just data analysis).
* Automation of consultant-style outputs.

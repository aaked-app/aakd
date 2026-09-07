# A decision-and-research operating system for serious startup/domain research

**Research date:** 2026-08-19

**Scope:** Product-agnostic research and strategic decisions under uncertainty. A contract-market example appears only to demonstrate the method.
**Evidence labels:** **FACT** = directly documented; **FORMAL RESULT** = follows from stated axioms/model; **EMPIRICAL EVIDENCE** = observed in a specified study/population; **HEURISTIC** = useful doctrine or practice, not a general scientific law; **SYNTHESIS** = recommendation derived here from multiple sources; **OPEN GAP** = evidence is insufficient. Terms such as *historical doctrine*, *practitioner*, *methodological*, *formal model* and *open-science practice* are secondary descriptors only; every claim still belongs to one or more of the six declared classes.

## Executive answer

**SYNTHESIS — high confidence.** First-principles reasoning is valuable for decomposing a question and exposing assumptions, but it is not a complete decision method. Used alone, it can produce internally elegant stories that ignore base rates, incentives, feedback, opportunity cost, measurement distortion and the cost of being wrong. The recommended operating system is a stack, not a flat list:

> **frame → observe → explain → challenge → decide → test → update**

At each stage, use a small set of complementary controls. Frame the actual decision, owner, values, constraints and reversibility. Observe with independent methods and a reference class. Explain with causal and systems models, while treating “first principles” as hypothesis generation. Challenge with risky predictions, inversion, premortem and a real adversary. Decide with opportunity cost, value of information, expected utility and ruin constraints. Test the cheapest diagnostic claim. Update probabilities and keep scored forecasts. Reopen a decision only when a recorded trigger fires.

This stack deliberately separates three unlike things:

1. **Normative/formal tools** say what follows if assumptions hold (Bayes, expected utility, value of information, Little’s Law).
2. **Empirical findings** describe observed behavior in bounded populations/tasks (base-rate neglect, “consider the opposite,” prospective hindsight, forecast calibration).
3. **Operating heuristics/doctrines** organize action (premortem, two-way doors, OODA, Theory of Constraints, Build–Measure–Learn).

The distinction matters: a memorable label does not make a management practice universal, and a theorem does not prove that its assumptions describe a particular market.

## The one-page recommended reasoning stack

| Stage | Required moves | Artifact | Gate: do not advance until… | Evidence that changes the decision |
|---|---|---|---|---|
| **1. Frame** | Write the decision, decision owner, deadline, stakeholders, objective/utility, non-negotiable constraints, opportunity cost, reversibility and what is outside scope. Mark facts, assumptions and values separately. | One-page decision brief + authority map | A named owner can choose; alternatives include “do nothing/defer”; irreversible downside and values are explicit. | A new constraint, different decision owner, dominated alternative, or credible ruin path reframes the decision. |
| **2. Observe** | Build a reference class; collect behavior, documents and outcomes; triangulate across methods with different biases; map actors, incentives, queues, feedback, delays and bottlenecks. | Evidence ledger + reference-class table + actor/incentive/system map | Provenance and limitations exist for every material claim; apparent independent sources are de-duplicated; observation is not confused with explanation. | Direct behavioral evidence, a changed base rate, contradictory method, uncovered actor, or bottleneck changes priorities. |
| **3. Explain** | Generate at least two causal models and the status quo explanation. Decompose with first principles, but reconcile each model with base rates, counterfactuals, incentives and second-order effects. | Competing-hypotheses table + causal/system diagram | Each model predicts something the others do not; causal language has a counterfactual or is relabeled association. | A mechanism-specific observation, negative control, process trace, natural experiment or failed prediction changes relative plausibility. |
| **4. Challenge** | State risky predictions and disconfirmers; invert; run a premortem; “consider the opposite”; steelman the strongest rival; if stakes justify it, use adversarial collaboration with a jointly agreed test. | Disconfirmation plan + premortem risk register | A critic agrees the rival was represented fairly; kill/continue criteria are recorded before results; auxiliary assumptions are named. | A preregistered disconfirming observation, repeated anomaly, assumption failure or newly identified failure mode triggers revision—not story repair. |
| **5. Decide** | Compare realistic alternatives using opportunity cost, expected utility/ranges, sensitivity analysis, tail/ruin constraints and value of information. Match process depth to reversibility. | Decision record + option/value-of-information table | The choice is robust across plausible ranges or explicitly a value/risk judgment; further research is worth more than it costs or is stopped. | A threshold crossing in expected utility, ruin probability, constraint, reversibility, or value of information changes the choice. |
| **6. Test** | Choose the smallest ethical test that can distinguish hypotheses. Work backward from the needed learning/measure to the intervention. Protect against Goodhart/Campbell effects; include guardrails and qualitative checks. | Test card: prediction, population, method, measure, guardrail, stop rule | The measure tracks the construct before it becomes a target; sample/task limits are stated; test can genuinely fail. | A threshold result, material unintended effect, guardrail breach, or evidence the measure is being gamed stops or redirects the test. |
| **7. Update** | Update probabilities; score forecasts; compare with base rate; record surprises, causal ambiguity and metric distortion; orient and run the next loop. Institutionalize decisions, not hindsight stories. | Update log + forecast scorecard + after-action review | Posterior belief and next action are explicit; result, interpretation and value judgment are separated; old records remain visible. | New likelihood-bearing evidence changes odds; calibration history changes trust/weight; a moved bottleneck or feedback loop changes the next observation. |

**Cadence rule (SYNTHESIS):** iterate quickly inside a stage when a decision is reversible and bounded; require wider evidence and an independent challenger before one-way, high-tail-risk, legal, safety or reputation decisions. Speed belongs in the loop; rigor belongs at the gates.

## Principle matrix

The matrix contains **25 distinct principles**. Confidence concerns the stated scope and operational use—not whether a slogan is universally true.

| # | Principle | Definition and what it prevents | Use / do not use | Evidence class, sources, limits and tensions |
|---:|---|---|---|---|
| 1 | **Decision framing, authority and values** | Define the choice, alternatives, objective, owner, affected parties, constraints and deadline. Prevents solving the wrong problem and hiding value judgments inside analysis. | Use first, especially with multiple principals. Do not let a frame freeze when new constraints or stakeholders appear. | **SYNTHESIS; high confidence.** Bounded rationality makes exhaustive choice unrealistic ([Simon 1955](https://doi.org/10.2307/1884852)); agency theory shows actors may not share objectives ([Jensen & Meckling 1976](https://doi.org/10.1016/0304-405X%2876%2990026-X)). A frame is a governance artifact, not an empirical truth. Tension: satisficing saves search cost but can entrench a poor initial frame. |
| 2 | **First-principles decomposition** | Break a claim into assumptions, mechanisms and constraints, then reconstruct alternatives. Prevents uncritical analogy and inherited category errors. | Use to generate explanations or expose hidden assumptions. Do not use it to discard accumulated empirical knowledge or claim certainty from logic alone. | **HEURISTIC; medium confidence.** Popper’s method emphasizes testable theoretical systems rather than authority ([Popper 1959](https://fenix.ciencias.ulisboa.pt/downloadFile/1688987299217625/Falsiability.pdf)); Simon shows real decision makers operate with bounded knowledge ([Nobel lecture 1978](https://www.nobelprize.org/prizes/economic-sciences/1978/simon/lecture/)). There is no general empirical theorem called “first-principles thinking.” Tension: reference classes constrain imaginative reconstruction; neither automatically dominates. |
| 3 | **Falsifiability and risky predictions** | Make a hypothesis prohibit some observable outcomes; prefer precise predictions that expose it to failure. Prevents unfalsifiable stories and confirmation-only research. | Use for discriminating claims and before seeing outcomes. Do not treat one failed observation as automatically killing a network of theory, measurement and auxiliary assumptions. | **HEURISTIC; high confidence about the historical doctrine, medium about business transfer.** Popper’s original account defines falsifiable theoretical systems ([1959 text](https://fenix.ciencias.ulisboa.pt/downloadFile/1688987299217625/Falsiability.pdf)). The Duhem–Quine problem means a failed prediction may implicate auxiliaries; contemporary synthesis describes why naive falsification is insufficient ([Gelman & Shalizi 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC4476974/)). Tension: falsification sets tests; Bayesian updating grades evidence rather than forcing binary rejection. |
| 4 | **Bayesian updating and calibrated uncertainty** | Express uncertainty as probabilities/odds, combine prior information with new likelihood-bearing evidence, and retain a posterior. Prevents all-or-nothing belief and base-rate amnesia. | Use for repeated uncertain judgments with defensible priors and likelihood assumptions. Do not manufacture precision or hide sensitivity to priors/model choice. | **FORMAL RESULT; high confidence conditional on model.** NIST describes prior + data → posterior ([NIST handbook](https://www.itl.nist.gov/div898/handbook/apr/section2/apr1a.htm)); FDA’s 2026 draft guidance requires attention to prior construction and operating characteristics in a bounded clinical-trial context ([FDA](https://www.fda.gov/media/190505/download)). Bayes is mathematically coherent, not proof that a chosen likelihood is correct. Tension: complements falsification; calibration requires external scoring, not coherent beliefs alone. |
| 5 | **Calibration and proper scoring** | A set of 70% forecasts should resolve true about 70% of the time; score forecasts so confidence becomes auditable. Prevents untracked overconfidence and retrospective certainty. | Use for repeatable, resolvable questions. Do not infer individual skill from a tiny or selectively chosen sample. | **FORMAL RESULT / EMPIRICAL EVIDENCE; high confidence for scoring, medium for transfer.** Brier introduced a proper score for probabilistic forecasts in weather tasks ([1950](https://doi.org/10.1175/1520-0493%281950%29078%3C0001%3AVOFEIT%3E2.0.CO%3B2)); forecasting research stresses calibration and sharpness ([Gneiting & Katzfuss 2014](https://doi.org/10.1146/annurev-statistics-062713-085831)). Performance is domain-, horizon- and question-dependent. Tension: a calibrated but uninformative forecaster can stay near base rates; sharpness matters too. |
| 6 | **Base rates and reference-class forecasting** | Start with outcomes from comparable cases, then adjust for case-specific evidence. Prevents planning fallacy, special-case storytelling and neglect of prevalence. | Use when a credible, sufficiently comparable class exists. Do not force a misleading class or ignore structural breaks. | **EMPIRICAL EVIDENCE / HEURISTIC; high confidence in project forecasting, medium in new-market transfer.** Flyvbjerg documents reference-class forecasting for major infrastructure projects ([2006](https://doi.org/10.1177/875697280603700302)); current UK guidance uses historical forecast errors and warns that classes must be relevant ([HM Treasury 2026](https://www.gov.uk/government/publications/the-green-book-appraisal-and-evaluation-in-central-government/the-green-book-2026)). Infrastructure evidence does not establish effect size in startup research. Tension: first principles identifies novelty; the reference class supplies the prior. |
| 7 | **Causal inference and counterfactuals** | A causal claim asks what would happen to the same target under an alternative intervention, not merely what co-varies. Prevents converting correlation, selection or sequence into mechanism. | Use when choosing interventions or explaining outcomes. Do not claim an identified effect without a defensible assignment mechanism, comparison and estimand. | **FORMAL FRAMEWORK / empirical design; high confidence.** Rubin formalized potential outcomes and explains why randomization is valuable while carefully controlled nonrandomized studies may be necessary ([1974](https://www.ets.org/research/policy_research_reports/publications/article/1974/hrbx.html)). Causal identification remains assumption-dependent; one unit cannot reveal both potential outcomes. Tension: systems maps generate pathways but do not by themselves identify causal effects. |
| 8 | **Systems thinking, feedback loops and second-order effects** | Map stocks, flows, actors, reinforcing/balancing feedback, delays and downstream responses. Prevents local optimization and linear “A causes B” stories in adaptive systems. | Use for multi-actor workflows, policies and delayed effects. Do not turn an unaudited causal-loop diagram into evidence or assume every effect is measurable. | **HEURISTIC; medium confidence.** Meadows explains stocks, flows, feedback and delays ([2008 primer](https://leaddev.com/wp-content/uploads/2020/08/meadows.pdf)); Howard shows sequential decisions affect future decisions ([1966](https://doi.org/10.1287/mnsc.12.5.317)). Specific loop claims require data. Tension: fast learning loops can perturb the system; second-order analysis can also become paralysis. |
| 9 | **Inversion and “consider the opposite”** | Ask how an effort fails, how to cause the unwanted outcome, and what evidence supports the rival view. Prevents one-sided search and biased assimilation. | Use after a candidate explanation exists. Do not substitute generic negativity for a specific rival mechanism. | **HEURISTIC + bounded EMPIRICAL EVIDENCE; medium confidence.** Two social-judgment experiments found reduced bias when participants considered opposing possibilities ([Lord, Lepper & Preston 1984](https://pubmed.ncbi.nlm.nih.gov/6527215/)); task and era limit transfer. Tension: overlaps with falsification and steelmanning; it is cheaper but weaker than a jointly designed adversarial test. |
| 10 | **Premortem / prospective hindsight** | Assume the plan has failed and independently generate causes before commitment. Prevents suppressed dissent and narrow risk lists. | Use for concrete plans before commitment, ideally with anonymous/independent inputs. Do not treat imagined causes as probabilities or as proof of mitigation. | **HEURISTIC with limited EMPIRICAL precursor; medium-low confidence.** Prospective-hindsight experiments examined how imagining a future outcome as completed changes explanations ([Mitchell, Russo & Pennington 1989](https://doi.org/10.1002/bdm.3960020103)); Klein translated the idea into the project premortem ([2007](https://hbr.org/2007/09/performing-a-project-premortem)). Recent work says surprisingly little research tests whether premortems work and flags self-serving attribution ([Academy of Management 2022](https://doi.org/10.5465/AMBPP.2022.12186abstract)). Tension: useful delay for one-way bets; excessive ceremony conflicts with OODA speed. |
| 11 | **Steelmanning and adversarial collaboration** | State the strongest rival case to its advocate’s satisfaction, then agree in advance on a test and, when useful, an arbiter. Prevents strawmen, reply cycles and tests biased toward one camp. | Use for consequential disputes with empirical cruxes. Do not force value disputes or parties lacking good faith into a fake experiment. | **HEURISTIC + demonstrated research protocol; medium confidence.** Mellers, Hertwig and Kahneman jointly specified tests and retained different interpretations after mixed results ([2001](https://doi.org/10.1111/1467-9280.00350)); one collaboration demonstrates feasibility, not universal superiority. Tension: agreement on a test can surface rather than resolve competing interpretations. |
| 12 | **Source and method triangulation** | Seek convergence across sources, methods, populations and error structures; investigate disagreement. Prevents dependence on one biased measure. | Use when methods have complementary weaknesses. Do not count copied reports, shared datasets, the same respondent pool or correlated incentives as independent confirmation. | **SYNTHESIS; high confidence.** The National Academies describes triangulation as combining evidence streams with distinct sources of bias ([2022](https://doi.org/10.17226/26538)); systematic-review standards require linking publications from the same study to avoid double counting ([IOM 2011](https://nap.nationalacademies.org/catalog/13059/finding-what-works-in-health-care-standards-for-systematic-reviews)). Convergence can still reflect shared bias. Tension: breadth improves robustness but can obscure mismatched estimands. |
| 13 | **Incentives and principal–agent analysis** | Map who decides, acts, knows, pays, benefits and bears failure; look for monitoring cost and goal divergence. Prevents treating stated preferences or job titles as revealed behavior. | Use in organizations, procurement, reporting and delegated work. Do not presume every relationship is opportunistic or reducible to money. | **FORMAL RESULT; high confidence as a model, context-dependent empirically.** Jensen and Meckling define agency relationships and agency costs ([1976](https://doi.org/10.1016/0304-405X%2876%2990026-X)). The model’s assumptions do not prove a particular actor’s motive. Tension: stated preference is evidence about narrative; behavior, budget and veto power are stronger evidence about incentives. |
| 14 | **Opportunity cost** | The relevant cost of choosing an option includes the value of the best feasible alternative forgone. Prevents evaluating an initiative against zero or sunk cost rather than the next-best use of scarce time/capital. | Use whenever resources or attention are constrained. Do not pretend subjective, unknown alternatives are precisely measurable. | **FORMAL RESULT; high confidence.** Buchanan emphasizes that observed outlays need not equal the decision maker’s sacrificed opportunity ([1969](https://www.econlib.org/library/Buchanan/buchCv6.html)). Tension: value of information competes with acting now; bounded rationality limits how many alternatives can be searched. |
| 15 | **Expected value, utility and risk** | Compare probability-weighted consequences using utility, not just average money; expose assumptions with ranges and sensitivity. Prevents choosing on upside, single-point estimates or probability alone. | Use when alternatives/outcomes can be made explicit. Do not apply point probabilities mechanically under deep uncertainty, nonstationarity or unmodeled values. | **FORMAL RESULT; high confidence conditional on axioms.** Von Neumann–Morgenstern expected-utility representation follows from preference axioms, not empirical proof of human behavior ([theorem exposition, UC Davis](https://faculty.econ.ucdavis.edu/faculty/bonanno/PDF/URI_book.pdf)). Empirical paradoxes and model misspecification limit descriptive use. Tension: maximize utility only after ruin/tail constraints and rights/values are explicit. |
| 16 | **Tail risk and ruin constraints** | Reject or cap options with plausible irreversible destruction even when an average payoff looks attractive. Prevents “positive expected value” arguments that ignore survival, fat tails or non-repeatable exposure. | Use for existential, safety, legal and highly irreversible downside. Do not label ordinary variance “ruin” to protect a favored status quo. | **FORMAL RESULT; medium confidence.** Tail-constraint work shows left-tail constraints can dominate portfolio choice under its model ([Geman, Geman & Taleb 2015](https://arxiv.org/abs/1412.7647)); findings do not automatically quantify startup risks. Tension: expected utility can encode catastrophic disutility, but only if the model actually includes it; acceptable risk remains partly a value judgment. |
| 17 | **Reversibility and commitment sizing** | Distinguish cheaply reversible “two-way” decisions from hard-to-reverse “one-way” decisions; scale evidence, authority and test size accordingly. Prevents equal bureaucracy for all choices and accidental lock-in. | Use for process depth and staged commitments. Do not call a decision reversible when reputation, data, legal duties, switching cost or path dependence remain. | **HEURISTIC; medium confidence.** Amazon’s 2016 shareholder letter is the primary corporate statement of one-way/two-way doors ([annual letters archive](https://ir.aboutamazon.com/annual-reports-proxies-and-shareholder-letters/default.aspx)). It is experience, not a controlled study. Tension: reversibility encourages experiments; commitment can itself create capability and credibility. Sunk cost is not a reason to continue, but switching cost and option value can be. |
| 18 | **Value of information (VoI)** | Research is worth doing only when its expected improvement to the decision exceeds its cost/delay; perfect information sets an upper bound. Prevents endless research and low-impact data collection. | Use to prioritize uncertain variables that could change the action. Do not compute false precision when utilities and likelihoods are unknown; use qualitative switching tests. | **FORMAL DECISION-ANALYSIS RESULT; high confidence conditional on model.** Howard integrates probability and economic consequence in information value theory ([1966](https://doi.org/10.1109/TSSC.1966.300074)). Tension: high VoI favors learning; OODA favors tempo. Resolve with decision sensitivity and delay cost. |
| 19 | **Bottleneck / constraint thinking** | Identify the resource or policy that currently limits system throughput; improve or protect it before optimizing nonconstraints. Prevents local efficiency work with no system effect. | Use for observable flows and queues. Do not assume one stable bottleneck in a changing, multi-objective system or generalize factory doctrine without validation. | **FORMAL RESULT + HEURISTIC.** Little proved `L = λW` under finite means, strict stationarity and metric transitivity ([1961](https://doi.org/10.1287/opre.9.3.383)); Goldratt’s focusing steps are a management heuristic, and reviews note theory/practice deficiencies ([Watson, Blackstone & Gardiner 2007](https://doi.org/10.1016/j.jom.2006.04.004)). Tension: global optimization may reveal interacting constraints; constraint focus intentionally postpones nonbinding improvements. |
| 20 | **Goodhart/Campbell effects and measurement integrity** | When a proxy becomes a consequential target, behavior can change in ways that reduce its validity. Prevents learning loops from optimizing the dashboard instead of the underlying outcome. | Use whenever metrics allocate status, money or continuation. Do not infer gaming from every metric shift; specify mechanisms and audit qualitatively. | **HEURISTIC / EMPIRICAL EVIDENCE; medium confidence.** Campbell’s formulation concerns corruption pressure from quantitative indicators; healthcare review discusses cases and safeguards ([Poku 2016](https://doi.org/10.1177/1355819615593772)). Effects depend on incentives and metric manipulability. Tension: learning requires measures; safe learning uses a metric portfolio, guardrails and periodic construct checks. |
| 21 | **Preregistration, decision records and kill criteria** | Record hypotheses, measures, thresholds, exceptions and stopping/continuation rules before outcomes. Prevents HARKing, threshold drift, selective memory and sunk-cost storytelling. | Use for confirmatory tests and consequential commitments. Do not block legitimate exploration; label deviations and exploratory findings instead. | **HEURISTIC / EMPIRICAL EVIDENCE; medium confidence.** Nosek et al. distinguish prediction from postdiction and argue preregistration exposes selective reporting ([2018](https://doi.org/10.1073/pnas.1708274114)); a 2023 systematic review finds widespread discrepancies between registrations and publications, so registration alone is not compliance ([Prospero review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10551944/)). Tension: rigid criteria can suppress discovery; preserve an exploratory lane and preregister only confirmatory claims. |
| 22 | **OODA (observe–orient–decide–act)** | Cycle through observation, interpretation/orientation, decision and action while incorporating feedback and environmental change. Prevents slow, static plans in adversarial/dynamic settings. | Use when tempo, adaptation and reversible action matter. Do not reduce it to “move fast” or skip orientation, ethics and irreversible-risk gates. | **HEURISTIC; medium-low confidence outside its historical military origin.** Boyd’s briefing is the primary doctrine ([Patterns of Conflict, 1986](https://www.coljohnboyd.com/static/documents/1986-12__Boyd_John_R__Patterns_of_Conflict__PDF.pdf)); Air University describes orientation as central ([Kometer 2007](https://www.airuniversity.af.edu/Portals/10/AUPress/Books/B_0107_KOMETER_COMMAND_AIR_WAR.PDF)). Business transfer lacks general causal validation. Tension: tempo versus deliberation is resolved by reversibility and stakes. |
| 23 | **Build–Measure–Learn / validated learning** | Turn a critical assumption into an intervention, observe a preselected measure, then change belief/action. Planning should work backward from learning to measure to build. Prevents output-as-progress and long untested execution. | Use for uncertain, testable and ethically bounded assumptions. Do not call engagement, interviews or shipment “validated” without a discriminating prediction and decision threshold. | **HEURISTIC; medium-low confidence.** Ries is the primary authorial source for the loop and “validated learning” ([Lean Startup principles](https://theleanstartup.com/principles)). It is not a general theorem that shorter loops cause venture success. Tension: metrics can be gamed; falsification, counterfactual design and preregistered thresholds make the loop diagnostic. |
| 24 | **Exploration versus exploitation** | Allocate resources between searching for new possibilities and refining known ones. Prevents both endless novelty and lock-in to a locally effective routine. | Use for portfolios and repeated learning. Do not expect a context-free optimal split. | **FORMAL RESULT; medium confidence.** March’s stylized models show adaptive exploitation can become effective short term yet self-destructive long term ([1991](https://doi.org/10.1287/orsc.2.1.71)). Simulation assumptions and organizational context limit transfer. Tension: bottleneck focus exploits; protected discovery capacity explores. The split is a strategic value/risk choice. |
| 25 | **Bounded rationality and satisficing** | Because time, information and cognition are limited, search until an explicit adequacy threshold is met rather than pretending to optimize over every possible option. Prevents analysis theater and impossible completeness. | Use for search budgets and low-stakes/reversible decisions. Do not lower the threshold where ruin, rights or one-way commitments demand more evidence. | **FORMAL RESULT / HEURISTIC; high confidence as boundary, context-dependent prescription.** Simon’s 1955 model formalizes simplified choice procedures ([QJE](https://doi.org/10.2307/1884852)) and his Nobel lecture connects bounded rationality to organizations ([1978](https://www.nobelprize.org/prizes/economic-sciences/1978/simon/lecture/)). Tension: satisficing controls research cost; VoI and tail risk determine when “good enough” is not enough. |

## Overlaps, contradictions and how to resolve them

| Tension | Why the concepts conflict | Operational resolution | Resolution type |
|---|---|---|---|
| **First principles vs reference classes** | Decomposition emphasizes mechanism and novelty; the outside view emphasizes historical similarity. Either can be abused to dismiss the other. | Use the relevant reference class as the prior, then adjust only for named, evidenced mechanism differences. Record how much each adjustment moves the estimate. If no class is credible, mark an open gap rather than inventing one. | Mostly context-resolved; the weight placed on genuine novelty remains judgment. |
| **Falsification vs Bayesian updating** | A strict falsification story sounds binary; Bayes changes degrees of belief. Failed predictions may also implicate auxiliary assumptions, measurement or implementation. | Before testing, state the focal claim, auxiliaries and expected observations under rivals. Use a severe failure to lower probability sharply; reserve rejection/kill gates for a recorded operational threshold. Do not rescue a theory with a new auxiliary after every failure. | Context-resolved by test severity and model audit; no universal rejection threshold. |
| **OODA/speed vs deliberation/premortem** | Fast cycles create tempo and fresh evidence; deliberation can uncover ruin paths and dissent but adds delay. | Two-way, bounded decisions use short loops. One-way, rights-affecting, legally consequential or ruin-exposed decisions require premortem, independent challenge and authority gate. “Orient” is not permission to skip the gate. | Context-resolved by reversibility, tail risk and delay cost. |
| **Expected value vs tail risk/ruin** | A positive mean can coexist with unacceptable irreversible downside; estimated probabilities may be weakest in the tail. | Apply hard survival/rights constraints first, then compare utility among admissible options. Stress-test probability ranges and dependence. | The constraint is context-resolved; acceptable ruin exposure is a value/governance judgment. |
| **Optimization vs bottleneck focus** | Global optimization considers all interactions; constraint thinking directs attention to the current limiting factor. Local optimization away from the constraint may have no throughput value, but a single-constraint story can be false. | Measure flow and queue first. Focus on a demonstrated current constraint; remap after it moves. Use system optimization where constraints interact or objectives conflict. | Context-resolved by system structure and measurement. |
| **Triangulation vs correlated-source pseudo-confirmation** | More citations can create confidence even when they copy one report, share a dataset or face identical incentives. | Ledger provenance, data origin, respondent pool, method and likely bias direction. Count evidence streams, not URLs. Investigate disagreement instead of averaging incompatible estimands. | Context-resolved if dependencies are observable; residual correlation is an uncertainty. |
| **Incentives vs stated preferences** | People can report genuine beliefs while behavior reflects budgets, vetoes, career risk, convenience or social desirability. | Treat statements as evidence about perception and language. Separately observe decisions, artifacts, spend, delays and consequences. Ask what each actor gains, loses and can block. | Context-resolved; motive attribution remains uncertain without stronger evidence. |
| **Reversibility vs sunk cost/commitment** | “We can reverse” may hide switching/reputation cost; “we already invested” may rationalize continuation. Yet commitment can create coordination and learning. | Ignore unrecoverable past cost in forward comparison. Include future switching cost, option value, path dependence and credibility effects. Stage commitment where those are uncertain. | Mostly formal/contextual; how much credibility or disruption matters is a value judgment. |
| **Learning loops vs metric gaming** | A loop needs a measure; tying continuation or reward to it changes behavior and can corrupt the proxy. | Use one decision metric plus guardrails and qualitative process checks. Audit whether the measure still tracks the construct. Rotate or revise metrics when incentives change. | Context-resolved; which outcomes deserve protection is a value judgment. |
| **Exploration vs exploitation** | Search can delay benefit; refinement can lock the organization into a local optimum. | Set separate budgets and review dates. Use exploration for high-VoI uncertainties and exploitation at the demonstrated constraint. | Resource split remains a strategic value/risk judgment. |
| **Preregistration/kill criteria vs discovery** | Fixed plans reduce hindsight flexibility but cannot anticipate every useful signal. | Maintain two lanes: confirmatory results are judged against the preregistered plan; exploratory observations are retained and tested on fresh evidence. Record deviations, never erase them. | Context-resolved by claim type. |
| **Satisficing vs rigor** | Search has real cost, but a low adequacy threshold can rationalize weak evidence. | Set the threshold from stakes, reversibility, tail risk and VoI before searching. A low-stakes reversible decision can be “good enough”; an irreversible decision cannot borrow that threshold. | Context-resolved, except acceptable residual risk is a value judgment. |

### What is genuinely complementary rather than contradictory

- **Falsification supplies diagnostic tests; Bayesian updating supplies graded belief change; calibration supplies accountability over time.** None substitutes for the other.
- **Reference classes estimate what usually happens; causal models explain why this case might differ; systems maps anticipate how actors respond.** A systems diagram is not a causal estimate.
- **Inversion is an individual prompt; premortem is a plan-risk process; steelmanning is a fairness norm; adversarial collaboration is a joint empirical protocol.** They differ in cost and strength.
- **OODA governs tempo in a changing environment; Build–Measure–Learn structures a learning experiment.** Both need measurement integrity, but only the latter explicitly centers a testable venture assumption.
- **Opportunity cost prices the alternative; VoI prices more research; expected utility compares uncertain consequences; reversibility determines commitment size.** These are separate terms in a decision, not four names for prioritization.

## Anti-cargo-cult rules

1. **Name the evidence class.** Do not cite a theorem as if it were a field experiment, a founder letter as if it were science, or a laboratory task as if it established a market-wide effect.
2. **Carry the assumptions.** `L = λW` requires the stated long-run/stationarity conditions; expected utility requires preference axioms; Bayesian results inherit priors and likelihoods.
3. **Carry the population and task.** “Consider the opposite” was tested in bounded social-judgment experiments, reference-class forecasting has unusually strong evidence in major projects, and neither effect size transfers automatically to market interviews.
4. **Do not worship labels.** “OODA,” “first principles,” “premortem” and “lean” are prompts to do specific work. If no artifact, prediction or changed decision follows, the label added no rigor.
5. **Count independent evidence paths, not links.** Ten articles repeating one survey remain one data origin. Independence concerns methods, samples, incentives and error directions.
6. **Do not confuse activity with learning.** Interviews, experiments and dashboards matter only if they can change a recorded belief or decision.
7. **Precommit without becoming blind.** Preserve discovery, but label it exploratory and seek fresh evidence before promoting it to a confirmed claim.
8. **Use precision proportional to knowledge.** A probability range with assumptions is more honest than a point estimate assembled from guesses. Qualitative VoI and sensitivity thresholds often outperform decorative arithmetic.
9. **Keep facts, inferences and values separate.** Evidence can change beliefs about consequences; it cannot determine how stakeholders ought to trade rights, fairness, survival and reward.
10. **Escalate process with stakes.** The stack is deliberately lightweight for reversible tests and deliberately slower for one-way or ruin-exposed commitments.

## Integrated operating method in practice

### 1. Frame / authority

Write the decision as a verb: “Choose which two workflow–segment pairs receive the next 12 interviews,” not “understand the market.” Name the decision owner, contributors, veto holders and people who bear consequences. Include the status quo and delay as alternatives. Define what success means, which harms are forbidden and when the decision must be made.

**Artifact:** decision brief and authority map.

**Gate:** no owner, no decision; no alternative, no comparison.
**Methods used:** framing, incentives/principal–agent, opportunity cost, bounded rationality, reversibility.

### 2. Observe / map

Begin outside-in. Assemble a reference class of comparable choices or workflows. Collect at least two genuinely different evidence types—for example, observed process artifacts plus interviews, or public records plus time-stamped workflow observation. Record the original data source and likely bias. Map actors, handoffs, waits, feedback, incentives and the current constraint.

**Artifacts:** source/evidence ledger, reference-class table, system/actor/incentive map.

**Gate:** material claims have provenance; duplicate evidence is linked; observed facts are distinct from explanations.
**Methods used:** reference classes, triangulation, systems thinking, incentives, bottlenecks.

### 3. Explain / generate alternatives

Generate at least three explanations: a favored mechanism, the strongest rival and a status-quo/no-problem explanation. First-principles decomposition identifies necessary assumptions; causal counterfactuals and system maps turn them into observable implications. State what each model predicts in a new case.

**Artifacts:** competing-hypotheses table and causal/system diagram.

**Gate:** each explanation has at least one discriminating observation; causal claims name intervention, outcome, target population and comparison.
**Methods used:** first principles, causal inference, feedback/second-order effects.

### 4. Challenge / disconfirm

For each leading explanation, record a risky prediction and a result that would materially lower belief. Invert the plan, run a premortem and ask a critic to steelman the rival. For a consequential disagreement, jointly specify a test and arbiter. Record auxiliaries so a failed test cannot be repaired casually after the fact.

**Artifacts:** disconfirmation table, premortem register, adversarial test protocol.

**Gate:** the result can be failure, and the strongest rival is represented fairly.
**Methods used:** falsification, inversion, premortem, steelmanning/adversarial collaboration, preregistration.

### 5. Decide / commit

Compare alternatives against the status quo. Show ranges, not just central estimates. Apply survival, rights, legal and ethical constraints before expected utility. Ask which unresolved uncertainty could actually switch the choice and whether learning its answer is worth its cost and delay. Match commitment to reversibility.

**Artifacts:** option table, utility/sensitivity analysis, qualitative or quantitative VoI analysis, decision record.

**Gate:** no dominated alternative survives; high-tail-risk options meet explicit constraints; remaining disagreement is labeled evidence, model or values.
**Methods used:** opportunity cost, expected utility/risk, ruin constraints, VoI, reversibility, satisficing.

### 6. Test / execute

Work backward: learning question → decision threshold → measure → smallest intervention. Specify population, recruitment, instrument, prediction, guardrails and stop rule. Use OODA tempo within the agreed boundary. For workflow research, an interview alone is not a test of operational pain; ask for a recent episode, artifact, sequence, delay and consequence.

**Artifact:** test card and live risk/guardrail dashboard.

**Gate:** the test can discriminate; the metric is not the objective; ethical/authority boundary is clear.
**Methods used:** Build–Measure–Learn, OODA, Goodhart/Campbell safeguards, constraint focus.

### 7. Update / institutionalize

Record the observation before interpretation. Update probabilities, score resolved forecasts and compare outcomes with the reference class. Note surprises, broken assumptions, metric gaming, moved constraints and second-order effects. Preserve the original record. Continue, change, stop or gather a named piece of information—not “research more.”

**Artifacts:** update log, Brier scorecard, after-action review, new decision record if a trigger fires.

**Gate:** posterior belief, decision and next trigger are explicit.
**Methods used:** Bayesian updating, calibration, exploration/exploitation, OODA/BML feedback.

## Worked example: choosing contract workflow–segment pairs for primary interviews

This example does **not** recommend a product, feature or target market. It shows how to choose where scarce primary-research effort goes.

### Frame

**Decision:** allocate 12 interview/observation slots across two of four candidate workflow–segment pairs:

- A: sales contracting in 20–100-person B2B services firms;
- B: procurement/vendor agreements in 100–500-person manufacturers;
- C: employment agreements in 50–250-person technology firms;
- D: renewal/obligation follow-through in 200–1,000-person multi-site service firms.

**Owner:** research lead. **Deadline:** one week. **Objective:** maximize expected information about repeated, consequential, reachable workflow problems—not maximize positive reactions. **Constraints:** no sensitive contract contents copied without permission; maintain geographic and role diversity; status quo is twelve generic interviews. **Reversibility:** interview allocation is mostly two-way, but a skewed sample can waste a cycle.

### Observe

Build a reference table from previous domain evidence: number of independently evidenced episodes, company-size/geography certainty, actors involved, observed artifact, recurrence, consequence and source dependencies. Draw each workflow as request → draft/review → approval → signature → post-signature action and mark waits and vetoes. Separately map who feels delay, who has budget, who bears legal risk and who can change the process.

**Do not count** ten community posts repeating the same vendor study as eleven observations. **OPEN GAP:** if mid-market geography/size is unknown, mark it unknown.

### Explain

For each pair, write competing explanations:

- **H1, workflow friction:** repeated coordination and missing state cause measurable delay or rework.
- **H2, volume-only explanation:** pain appears only at unusually high transaction volume, not from the workflow itself.
- **H3, governance explanation:** apparent “tool pain” is unresolved authority or policy conflict.
- **H0, salience without consequence:** people complain, but the process creates little economic/operational harm.

First principles helps decompose required actors, information, authority and state transitions. The outside view prevents assuming these pairs are unique. Each hypothesis needs a discriminating prediction—for example, H1 predicts a recent episode with reconstructable handoff/rework and consequence; H0 predicts complaints without an episode or changed business outcome.

### Challenge

Premortem: “The 12 interviews produced persuasive quotes but no decision.” Likely causes: recruited only enthusiasts, relied on hypotheticals, mixed roles that face different incentives, accepted unauditable company-size claims, asked leading questions, or sampled only signed contracts and missed post-signature work.

Precommit kill/downweight criteria for a pair:

- fewer than 3 of 6 participants can reconstruct a recent episode with an artifact or time-anchored sequence;
- the asserted consequence cannot be distinguished from general workload;
- recurrence is rare and participants would not reallocate time/budget to change it;
- evidence comes from only one role or one recruitment channel.

Ask an independent critic to make the best case for H0/H2 and approve the interview prompts. These thresholds are **HEURISTIC research gates**, not population estimates.

### Decide

Score each pair on ranges for: prior evidence strength, probability the next interview changes belief, consequence, recurrence, access/recruitment cost, independence from existing evidence and risk of sample bias. Apply VoI: a pair with weak evidence but a decisive, cheap interview may outrank a familiar pair with low incremental learning. Select two pairs only if the ranking is robust to plausible weight changes; otherwise allocate a small exploratory tranche across three.

Do not claim an expected-value calculation is scientific if the inputs are judgmental. Preserve the ranges and sensitivity switch points.

### Test

For each selected pair, run six recent-episode interviews across at least two roles and two recruitment channels. Work backward from the learning question. Collect sequence, actors, waits, workaround, consequence and a permissible artifact/proxy; ask for counterexamples and the last time the process worked well. Track the decision metric (fraction of independently reconstructable, recurrent, consequential episodes) plus guardrails (role/channel diversity, no leading prompts, no unauthorized contents).

### Update

Before interviews, record a probability that at least four of six in each pair will meet the episode standard. Afterward, update separately for each hypothesis; do not convert one vivid story into prevalence. Score the forecast when resolved. Continue a pair only if the recorded threshold is met; otherwise stop, change the hypothesis or identify one high-VoI missing observation. A new bottleneck or actor can reframe the next cycle.

## Reusable compact decision record

```markdown
# Decision: [verb + object]
Date / review date:
Owner / contributors / veto or approval authority:

## Frame
Decision deadline:
Objective and decision metric:
Non-negotiable constraints / forbidden harms:
Reversibility: [two-way / costly-to-reverse / one-way] because:
Status quo and opportunity cost:

## Alternatives
1. [option]
2. [option]
3. Do nothing / defer

## Evidence and models
Reference class / base rate:
Key observations (link ledger):
Leading explanation + strongest rival + status-quo explanation:
Incentives / actors / bottleneck / feedback:
What is FACT vs INFERENCE vs VALUE:

## Uncertainty and challenge
Probability/range for each decision-relevant claim:
Risky prediction and disconfirming result:
Premortem top 3 failure modes:
Tail/ruin or rights constraint:
Highest-value missing information; cost and delay:

## Choice
Decision and rationale:
Why alternatives lost (including opportunity cost):
Sensitivity: what assumption/threshold would switch the choice?
Commitment size / rollback or exit:

## Test and update
Prediction / population / method / metric / guardrails:
Continue–change–stop thresholds recorded before outcome:
Next observation date:
Reopen only if [named trigger]:
Outcome, posterior update and forecast score (append; never overwrite):
```

## Printable checklist

### Frame

- [ ] Is there one concrete decision, a named owner, deadline and authority boundary?
- [ ] Are status quo, defer and the best feasible alternative included?
- [ ] Are facts, assumptions, values and constraints visibly separate?
- [ ] Is reversibility honest about legal, reputation, data and switching costs?

### Observe

- [ ] Is there a relevant reference class or an explicit open gap?
- [ ] Does each material claim have provenance, limitation and date?
- [ ] Are source dependencies and shared datasets de-duplicated?
- [ ] Are actors, incentives, handoffs, feedback, delays and current bottleneck mapped?

### Explain

- [ ] Are there at least two rival mechanisms plus the status-quo explanation?
- [ ] Does each causal claim specify intervention, comparison, outcome and population?
- [ ] Did first-principles decomposition reconcile with, rather than erase, base rates?
- [ ] Does each explanation make a distinct prediction?

### Challenge

- [ ] What observation would materially lower belief or kill the plan?
- [ ] Were auxiliary assumptions written before the result?
- [ ] Did someone steelman the strongest rival fairly?
- [ ] Was a premortem used proportionally to stakes—and kept separate from probability estimates?

### Decide

- [ ] Are opportunity cost, uncertainty ranges and sensitivity switch points explicit?
- [ ] Were ruin, rights and one-way risks screened before expected value?
- [ ] Could more information change the action, and is its value greater than cost/delay?
- [ ] Is remaining disagreement labeled as evidence, model or values?

### Test

- [ ] Does the test target the decision’s highest-value uncertainty?
- [ ] Can the prediction genuinely fail in the specified population/task?
- [ ] Are metric, guardrails, bias risks and stop criteria recorded in advance?
- [ ] Is the action the smallest ethical/reversible test that can discriminate?

### Update

- [ ] Were observation and interpretation recorded separately?
- [ ] Were probabilities updated and resolved forecasts scored?
- [ ] Were reference class, bottleneck, feedback and metric validity rechecked?
- [ ] Is the next action continue/change/stop/specific evidence—not “research more”?

## Evidence and source ledger

“Primary/authoritative” means the original paper/author/doctrine or an official scientific/government/institutional source. It does **not** mean the source proves transfer to startup or market research. Practitioner-primary sources are kept separate from scientific/authoritative sources even when they originated the named practice.

| ID | Author / institution | Date | Evidence class | Principle(s) supported | Primary / authoritative? | URL | Material limitation |
|---:|---|---:|---|---|:---:|---|---|
| S01 | Karl Popper | 1959 English ed. | **HEURISTIC** (philosophy/doctrine) | Falsifiability; first principles | Yes | [The Logic of Scientific Discovery](https://fenix.ciencias.ulisboa.pt/downloadFile/1688987299217625/Falsiability.pdf) | Philosophy of science; not an empirical business-effect study; naive single-test rejection is inadequate. |
| S02 | Andrew Gelman & Cosma Shalizi | 2013 | **SYNTHESIS** (scholarly) | Bayes–falsification tension; auxiliary assumptions | No | [Philosophy and the practice of Bayesian statistics](https://pmc.ncbi.nlm.nih.gov/articles/PMC4476974/) | Authors’ methodological synthesis, not a consensus theorem. |
| S03 | NIST/SEMATECH | current handbook, accessed 2026-08-19 | **FACT / FORMAL RESULT** | Bayesian updating | Yes | [Bayesian reliability evaluation](https://www.itl.nist.gov/div898/handbook/apr/section2/apr1a.htm) | Reliability-engineering examples; transfer requires a suitable likelihood/prior. |
| S04 | U.S. Food and Drug Administration | Jan. 2026 draft | **FACT / SYNTHESIS** (official guidance) | Bayesian updating, operating characteristics | Yes | [Bayesian methodology draft guidance](https://www.fda.gov/media/190505/download) | Draft drug/biologic trial guidance, not startup guidance; subject to revision. |
| S05 | Glenn W. Brier, U.S. Weather Bureau | 1950 | **FORMAL RESULT** | Calibration/proper scoring | Yes | [Verification of forecasts](https://doi.org/10.1175/1520-0493%281950%29078%3C0001%3AVOFEIT%3E2.0.CO%3B2) | Developed for probabilistic weather forecasts; score interpretation needs a suitable question set. |
| S06 | Tilmann Gneiting & Matthias Katzfuss | 2014 | **SYNTHESIS** (scholarly review) | Calibration and sharpness | Yes | [Probabilistic forecasting](https://doi.org/10.1146/annurev-statistics-062713-085831) | Technical forecasting review; calibration alone does not imply useful discrimination. |
| S07 | Bent Flyvbjerg | 2006 | **EMPIRICAL EVIDENCE / HEURISTIC** | Reference-class forecasting | Yes | [From Nobel Prize to Project Management](https://doi.org/10.1177/875697280603700302) | Major-project/infrastructure data; selection and comparability matter; effect size does not transfer automatically. |
| S08 | HM Treasury | 2026 | **FACT / HEURISTIC** (official guidance) | Base rates, reference classes, risk | Yes | [The Green Book 2026](https://www.gov.uk/government/publications/the-green-book-appraisal-and-evaluation-in-central-government/the-green-book-2026) | UK public appraisal context; generic uplifts are not market priors. |
| S09 | Donald B. Rubin | 1974 | **FORMAL RESULT / EMPIRICAL EVIDENCE** (design framework) | Counterfactual causal inference | Yes | [Estimating causal effects](https://www.ets.org/research/policy_research_reports/publications/article/1974/hrbx.html) | Identification depends on design/assignment assumptions; no unit reveals both potential outcomes. |
| S10 | Donella Meadows | 2008 | **HEURISTIC** (systems doctrine) | Stocks, flows, feedback, delays | Yes | [Thinking in Systems](https://leaddev.com/wp-content/uploads/2020/08/meadows.pdf) | Explanatory primer; a systems map is not itself causal evidence. |
| S11 | Ronald A. Howard | 1966 | **FORMAL RESULT / SYNTHESIS** | Sequential decisions, second-order consequences | Yes | [Dynamic Programming](https://doi.org/10.1287/mnsc.12.5.317) | Applies to specified sequential models; real state/action spaces may be unknown. |
| S12 | Charles Lord, Mark Lepper & Elizabeth Preston | 1984 | **EMPIRICAL EVIDENCE** | Consider-the-opposite / inversion | Yes | [Considering the opposite](https://pubmed.ncbi.nlm.nih.gov/6527215/) | Two social-judgment experiments; population/task and historical context limit generalization. |
| S13 | Deborah Mitchell, J. Edward Russo & Nancy Pennington | 1989 | **EMPIRICAL EVIDENCE** | Prospective hindsight | Yes | [Back to the future](https://doi.org/10.1002/bdm.3960020103) | Tests temporal perspective/explanation generation, not downstream project success. |
| S14 | Gary Klein | 2007 | **HEURISTIC** (practitioner) | Project premortem | No | [Performing a Project Premortem](https://hbr.org/2007/09/performing-a-project-premortem) | Practice article; no controlled general effectiveness estimate. |
| S15 | Academy of Management Proceedings | 2022 | **EMPIRICAL EVIDENCE / OPEN GAP** | Premortem limits | Yes | [Problems with Premortems](https://doi.org/10.5465/AMBPP.2022.12186abstract) | Conference abstract and bounded studies; flags thin evidence and attribution risk rather than settling effectiveness. |
| S16 | Barbara Mellers, Ralph Hertwig & Daniel Kahneman | 2001 | **EMPIRICAL EVIDENCE / HEURISTIC** | Adversarial collaboration | Yes | [Frequency representations and conjunction effects](https://doi.org/10.1111/1467-9280.00350) | One dispute/protocol; parties retained different interpretations. |
| S17 | National Academies of Sciences, Engineering, and Medicine | 2022 | **SYNTHESIS** (authoritative proceedings) | Evidence triangulation | Yes | [Triangulation in environmental epidemiology](https://doi.org/10.17226/26538) | Workshop proceedings, not a consensus causal-effect estimate; health-assessment focus. |
| S18 | Institute of Medicine / National Academies | 2011 | **SYNTHESIS** (authoritative standards) | Source independence, systematic evidence | Yes | [Finding What Works in Health Care](https://nap.nationalacademies.org/catalog/13059/finding-what-works-in-health-care-standards-for-systematic-reviews) | Systematic clinical-review standards need proportional adaptation for exploratory domain research. |
| S19 | Todd Jick | 1979 | **SYNTHESIS / EMPIRICAL EVIDENCE** (methods) | Mixed-method triangulation | Yes | [Triangulation in action](https://www.pm.lth.se/fileadmin/_migrated/content_uploads/Jick_1979__Mixing_qualitative_and_quantitative_methods_-_Triangulation_in_action.pdf) | Classic organizational case/method paper; convergence can still share bias. |
| S20 | Michael Jensen & William Meckling | 1976 | **FORMAL RESULT** (economic model) | Incentives; principal–agent problems | Yes | [Theory of the firm](https://doi.org/10.1016/0304-405X%2876%2990026-X) | Model assumptions do not establish a particular person’s motives; nonfinancial goals matter. |
| S21 | James Buchanan | 1969 | **FORMAL RESULT / HEURISTIC** (economic theory) | Opportunity cost | Yes | [Cost and Choice](https://www.econlib.org/library/Buchanan/buchCv6.html) | Opportunity cost can be subjective and unobservable; not equal to accounting outlay. |
| S22 | Giacomo Bonanno, UC Davis | current text, accessed 2026-08-19 | **FORMAL RESULT** (university exposition) | von Neumann–Morgenstern expected utility | No | [Decision theory text](https://faculty.econ.ucdavis.edu/faculty/bonanno/PDF/URI_book.pdf) | Exposition of an axiomatic representation theorem, not evidence that people behave accordingly. |
| S23 | Donald Geman, Hélyette Geman & Nassim Nicholas Taleb | 2015 preprint | **FORMAL RESULT** (model) | Tail constraints / ruin | Yes | [Tail Risk Constraints and Maximum Entropy](https://arxiv.org/abs/1412.7647) | Portfolio model and preprint; does not quantify nonfinancial startup tail risks. |
| S24 | Amazon | 2016 shareholder letter | **HEURISTIC** (practitioner-primary) | One-way / two-way doors | No | [Annual letters archive](https://ir.aboutamazon.com/annual-reports-proxies-and-shareholder-letters/default.aspx) | Corporate operating experience, not a controlled study; “reversible” is context-dependent. |
| S25 | Ronald A. Howard | 1966 | **FORMAL RESULT** | Value of information | Yes | [Information Value Theory](https://doi.org/10.1109/TSSC.1966.300074) | Requires specified probabilities and consequences; estimates can be judgmental. |
| S26 | John D. C. Little | 1961 | **FORMAL RESULT** | Queues, throughput and constraint diagnosis | Yes | [A proof for `L = λW`](https://doi.org/10.1287/opre.9.3.383) | Requires finite means and stated stationarity/transitivity; it does not identify which intervention is best. |
| S27 | Kevin Watson, John Blackstone & Stanley Gardiner | 2007 | **SYNTHESIS** (scholarly review) | Theory of Constraints and its limits | Yes | [Evolution of a management philosophy](https://doi.org/10.1016/j.jom.2006.04.004) | Historical/review assessment; reported adoption is not universal causal validation. |
| S28 | Michael Poku | 2016 | **SYNTHESIS / EMPIRICAL EVIDENCE** | Campbell effects, metric gaming | Yes | [Campbell’s Law in health care](https://doi.org/10.1177/1355819615593772) | Health-sector examples; gaming depends on incentive strength and proxy manipulability. |
| S29 | Brian Nosek, Charles Ebersole, Alexander DeHaven & David Mellor | 2018 | **SYNTHESIS / EMPIRICAL EVIDENCE** | Preregistration; prediction vs postdiction | Yes | [The preregistration revolution](https://doi.org/10.1073/pnas.1708274114) | Advocacy/method paper; preregistration raises transparency but does not guarantee design quality or adherence. |
| S30 | Robert Thibault et al. | 2023 | **EMPIRICAL EVIDENCE** (systematic review/meta-analysis) | Registration adherence limits | Yes | [Registration–publication discrepancies](https://pmc.ncbi.nlm.nih.gov/articles/PMC10551944/) | Heterogeneous disciplines and registration definitions; does not isolate preregistration’s causal effect. |
| S31 | John R. Boyd | 1986 briefing | **HEURISTIC** (historical doctrine) | OODA | Yes | [Patterns of Conflict](https://www.coljohnboyd.com/static/documents/1986-12__Boyd_John_R__Patterns_of_Conflict__PDF.pdf) | Military doctrine/briefing, not a controlled business-effect study. |
| S32 | James Kometer / Air University Press | 2007 | **SYNTHESIS** (authoritative military study) | OODA and orientation | Yes | [Command in Air War](https://www.airuniversity.af.edu/Portals/10/AUPress/Books/B_0107_KOMETER_COMMAND_AIR_WAR.PDF) | Military command context; historical interpretation and transfer limits. |
| S33 | Eric Ries | current site, accessed 2026-08-19; doctrine from 2011 book | **HEURISTIC** (practitioner-primary) | Build–Measure–Learn; validated learning | No | [Lean Startup principles](https://theleanstartup.com/principles) | Originator’s methodology page; no general causal estimate of startup success. |
| S34 | James G. March | 1991 | **FORMAL RESULT** (stylized simulations) | Exploration vs exploitation | Yes | [Exploration and Exploitation in Organizational Learning](https://doi.org/10.1287/orsc.2.1.71) | Stylized organizational models; no universal optimal allocation. |
| S35 | Herbert Simon | 1955 | **FORMAL RESULT / HEURISTIC** (behavioral model) | Bounded rationality, satisficing | Yes | [A Behavioral Model of Rational Choice](https://doi.org/10.2307/1884852) | Model of simplified choice, not a single prescriptive threshold for all decisions. |
| S36 | Herbert Simon / Nobel Foundation | 1978 | **SYNTHESIS** (authoritative primary lecture) | Organizational bounded rationality | Yes | [Rational Decision-Making in Business Organizations](https://www.nobelprize.org/prizes/economic-sciences/1978/simon/lecture/) | Laureate synthesis, not a new experiment. |
| S37 | American Statistical Association | 2016 | **SYNTHESIS** (authoritative statement) | Uncertainty, threshold misuse, transparency | Yes | [ASA statement on p-values](https://doi.org/10.1080/00031305.2016.1154108) | Focused on statistical inference; does not endorse a single replacement method. |
| S38 | National Academies | 2014 workshop | **SYNTHESIS** (authoritative proceedings) | Mixed-method triangulation and theory change | Yes | [Evaluation Design for Complex Global Initiatives](https://www.ncbi.nlm.nih.gov/books/n/nap18739/pdf/) | Workshop summary; recommendations are not experimental effect estimates. |

### Ledger totals

- **38 unique credible sources.**
- **33 primary/authoritative sources (86.8%)** under the declared rule; five are credible secondary/practitioner sources (S02, S14, S22, S24, S33).
- Source classes are intentionally mixed: original empirical papers, formal results/models, original doctrines, official guidance/standards, scholarly syntheses and practitioner-primary heuristics.
- No source is counted twice even where one source supports multiple principles.

## Rules-based acceptance audit

| Rule | Result | Deterministic evidence |
|---|---|---|
| At least 15 distinct principles | **PASS** | 25 numbered principle rows. |
| Every required named principle appears in the matrix | **PASS** | Falsifiability; Bayesian updating; inversion; premortem; systems/second-order effects; opportunity cost; expected value/utility/risk; reversibility; base rates/reference classes; steelmanning/adversarial collaboration; triangulation; incentives/principal–agent; bottleneck/constraints; OODA; and Build–Measure–Learn are explicit. |
| At least 25 unique credible sources | **PASS** | 38 unique `S01`–`S38` ledger rows. |
| At least 60% primary/authoritative | **PASS** | 33/38 = 86.8% under the declared classification; nonqualifying IDs are explicit. |
| Empirical claims have direct source and population/task limitation | **PASS** | Matrix and ledger pair empirical claims with source and limitation; business-transfer claims are not made from bounded studies. |
| Heuristics are not mislabeled as validated science | **PASS** | Premortem, reversibility, OODA and Build–Measure–Learn are explicitly **HEURISTIC**; limitations are stated. |
| Evidence taxonomy is normalized | **PASS** | Every bold parent label is one or a combination of the six declared labels; parentheticals are non-parent qualifiers. |
| Explicit overlaps and contradictions | **PASS** | 12-row tensions table plus complementary-concepts section; context resolutions and value judgments are distinguished. |
| Anti-cargo-cult caveats | **PASS** | Ten explicit rules cover assumptions, transfer, source correlation, metrics, precision and stakes. |
| Recommended stack, not a flat list | **PASS** | One-page stack in exact order **frame → observe → explain → challenge → decide → test → update**, followed by stage procedures. |
| Stack has artifacts, gates and decision-changing evidence | **PASS** | Each of seven stage rows contains all three. |
| Practical contract-market research example | **PASS** | Worked workflow–segment interview-allocation example covers all seven stages without product features or positioning. |
| Compact reusable decision record | **PASS** | Copyable Markdown template with frame, alternatives, evidence, challenge, choice, test and update. |
| Printable practical checklist | **PASS** | 28 checkboxes across seven stages. |
| Product-agnostic / prohibited-name scan | **PASS** | Case-insensitive scan for the two prohibited project/product names returns zero matches. |
| Source URL reachability checked | **PASS with access caveat** | 38 retained unique document URLs plus one superseded unencoded DOI variant were checked 2026-08-19: 20 returned HTTP 200, one 202, one 203; 17 DOI/publisher or protected endpoints returned HTTP 403 to automated `curl` but resolved in browser/search verification. No retained URL returned 404 after encoding the Jensen–Meckling DOI. HTTP status proves reachability, not evidentiary quality. |
| Size report | **PASS** | `wc` after final content: **405 lines; 8,589 words**. |
| Markdown/patch hygiene | **PASS** | `git diff --check` run after final edit. |

**Overall: PASS (18/18 rules).** The URL rule carries an access caveat, not an evidence failure: publisher bot protection is reported rather than treated as source invalidity.

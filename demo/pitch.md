# UPSCALE: hackathon pitch script

Length: about 5 minutes talking, 3 minutes live demo, then Q&A.
Tone: plain and confident. Say the problem in the customer's words before you say a feature.

---

## 0. Opening (20 seconds)

"Imagine you sell handmade leather bags from Lekki. Someone sees your Instagram post and messages you at 9pm: 'How much is the big bag?' You are asleep. By morning they have bought from someone who replied in two minutes.

That is not a marketing problem. It is a **reply** problem. UPSCALE fixes it."

---

## 1. The problem, with numbers (60 seconds)

Say each number once, then name its source out loud. Judges trust a number more when you cite it.

**Nigeria runs on small businesses that sell in chat.**
- About **39.6 million** MSMEs, roughly **88% of employment** and **46% of GDP** (NBS/SMEDAN 2021 survey, as reported by PwC).
- Over **half** of surveyed Nigerian MSMEs sell online *only* through social media like WhatsApp, Instagram and Facebook (GSMA research on Nigerian MSME e-commerce).

**Those businesses lose customers on speed.**
- Harvard Business Review audited **2,241 companies**: **23% never replied** to a test enquiry, **24% took more than a day**, and the average reply took **42 hours** (Oldroyd et al., HBR 2011).
- In a study of **1.25 million leads**, firms that responded within an hour were about **7 times more likely** to qualify the lead than firms that waited one more hour, and over **60 times** more likely than those that took a day or more (HBR).
- MIT/InsideSales research (2007) found a lead contacted within **5 minutes** is about **21 times** more likely to be qualified than one contacted after 30 minutes.

Bridge line: "Those studies are about web enquiries in the US. Now think about a one-person shop answering Telegram and Instagram between customers. The gap is bigger, not smaller."

---

## 2. Pain points and what solves each one (2 minutes)

Use this order. For each: say the pain, say the feature, point at it in the demo.

| Pain the owner feels | UPSCALE feature | Built today |
|---|---|---|
| "I reply too late, or not at all." | AI assistant answers on Telegram in seconds, any hour, in the business's tone. | Yes |
| "The bot would not know my prices." | **Knowledge page**: products, prices, FAQs, CSV import. It quotes only what you added and says "I will check with the team" otherwise. | Yes |
| "I cannot tell who is serious." | Every chat is qualified (need, budget, timeline, decision maker) and scored HOT, WARM or COLD. | Yes |
| "My leads are in DMs, notebooks and my head." | One lead list. Add leads by hand, import a CSV, or capture them from ads with a **chat link** and an **enquiry form**. Source tags show which ad worked. | Yes |
| "Some people need a human." | **Take over** from the dashboard, reply from your own bot, then hand back to the AI. | Yes |
| "Old leads go cold." | **Broadcast** to past leads with filters, templates and opt-out handling. | Yes |
| "I miss meetings and visits." | **Calendar** linked to each lead. | Yes |
| "Chat to payment is messy." | Payment links through Bachs from the lead page. | Built; needs Bachs Connect enabled (see Q&A) |
| "I do not know what is working." | **Overview**: leads, qualification rate, conversion rate, revenue (paid only), pipeline, recent conversations. | Yes |

Say plainly: "Everything on this list is running. Automatic follow-up sequences are next on the roadmap."

---

## 3. Live demo (3 minutes)

Do this once beforehand so you know the timing. Keep one phone with Telegram open next to the laptop.

1. **Customer side (phone).** Message the bot: "hi". Show the short, warm reply with the customer's first name and what the business offers.
2. Ask: "what do you have in store". Show it gives a short overview, not a dump.
3. Say: "I need something to carry my laptop, not too expensive". Show it recommends the sleeve with the price from the Knowledge page.
4. **Dashboard.** Open Leads, open that lead. Show the transcript, the score and the details the bot extracted.
5. **Take over.** Click Take over, type a reply, send. Show it arrive on the phone. Click Hand back to AI.
6. **Capture.** Open Lead capture, show the chat link and the enquiry form. Mention the source tag.
7. **Add or import.** Import `demo/demo-leads.csv` and show the report (imported, duplicates skipped, bad rows listed).
8. **Overview.** End on the Overview page: real numbers from what you just did.

If anything fails live, say "that is the live system, not a recording" and move on to the next step. Do not apologise at length.

---

## 4. Why UPSCALE and not HubSpot (30 seconds)

"HubSpot is built for a marketing team with forms and email. Our customer sells in chat, answers alone and pays in naira. UPSCALE starts where their customers already are, replies for them, and costs ₦3,500 to ₦10,000 a month, a fraction of a typical CRM seat. We are not trying to be a better HubSpot. We are the sales assistant a one-person shop never had."

---

## 5. Close (20 seconds)

"Customers do not leave because your product is bad. They leave because nobody answered. UPSCALE makes sure someone always does. Telegram today, WhatsApp next. Thank you."

---

## Q&A preparation

**"How does the AI know my business?"**
It is not retrained. Each message goes to the model with your business description, your instructions and the relevant entries from your Knowledge page. Change a price in the dashboard and the next reply uses it. If something is not in the Knowledge page, it is told to say it will check with the team instead of guessing.

**"What stops it from lying about prices or promising things?"**
Prices, delivery and policies come only from your entries. It never claims to be human, never invents discounts, and hands off to a person when the customer asks or is ready to buy.

**"Why Telegram and not WhatsApp?"**
Telegram's bot API is open and free, so we could ship a real product now. WhatsApp needs Meta business verification, approved message templates and per-message fees. Our leads, conversations and broadcast are channel-independent, so adding WhatsApp is one new sender and one new inbound webhook. Plan: register as a Meta Tech Provider so each business onboards in a few clicks; until then use a business solution provider; keep a library of pre-approved templates; keep the opt-in and opt-out tracking we already have.

**"What about WhatsApp's limits?"**
Free-form replies only inside 24 hours of the customer's last message (the bot lives inside that window); anything else needs approved templates; new numbers have low daily sending limits that grow with quality rating; messages are priced per conversation. We design for all of that rather than hide it.

**"Is customer data safe? Can businesses see each other's data?"**
Every query is scoped to the organization from the signed-in session, never from the request body. Bot tokens are encrypted. Contacts who send "stop" or block the bot are excluded from broadcasts.

**"How do you make money?"**
Three tiers: ₦3,500 Basic, ₦5,000 Growth, ₦10,000 Scale per month with a 14-day trial, collected through Bachs.

**"What is not finished?"**
Be direct: automatic follow-up sequences and appointment reminders need a scheduler (roadmap); WhatsApp is next; customer payment links depend on Bachs enabling Connect for our platform account. Everything shown in the demo is live.

---

## Claims to avoid

- Do not say "80% of sales need five follow-ups". It is widely repeated but traces back to a small, very old survey, so skip it.
- Do not present the 21x and 7x figures as one study. 21x is MIT/InsideSales (2007, a vendor co-sponsored it). 7x and 60x are HBR (2011).
- Do not say "WhatsApp is supported". Say "WhatsApp is next".
- Do not say messages are "delivered". Telegram confirms acceptance, not reading.
- If asked for exact GDP or employment figures, say "about" and cite NBS/SMEDAN as reported by PwC. Sources differ slightly on the exact decimals.

## Sources

- [The Short Life of Online Sales Leads, HBR 2011 (BYU ScholarsArchive record)](https://scholarsarchive.byu.edu/facpub/9711)
- [Are you letting online leads go cold? (SmartCompany summary of the HBR findings)](https://www.smartcompany.com.au/marketing/20110704-are-you-letting-online-leads-go-cold/)
- [InsideSales/MIT Lead Response Management study, 2007 (press summary)](https://www.insidesales.com/xant-com-research-stuns-2007-marketing-sherpa-b2b-summit)
- [PwC Nigeria MSME Survey Report 2024 (cites the NBS/SMEDAN 2021 survey)](https://www.pwc.com/ng/en/assets/pdf/msme-survey-report-july-2024.pdf)
- [GSMA: E-commerce in Nigeria, the opportunity for MSMEs](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/gsma_resources/webinar-e-commerce-in-nigeria-unleashing-the-opportunity-for-msmes/)

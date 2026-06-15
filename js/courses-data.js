/* ===== AFRORAMA MICRO-COURSES ===== */

const BADGES = [
  { id:'first-step',   icon:'🌱', name:'First Step',         desc:'Complete your first lesson.',                        colour:'#3F7E44' },
  { id:'cv-ready',     icon:'📄', name:'CV Ready',           desc:'Complete the Craft an Impactful CV course.',          colour:'#26BDE2' },
  { id:'money-minded', icon:'💰', name:'Money Minded',       desc:'Complete the Road to Financial Freedom course.',      colour:'#DDA63A' },
  { id:'on-fire',      icon:'🔥', name:'On Fire',             desc:'Complete lessons 5 days in a row.',                   colour:'#E5243B' },
  { id:'scholar',      icon:'🏆', name:'Afrorama Scholar',   desc:'Complete all available courses.',                     colour:'#19486A' },
];

const COURSES = [
  {
    id: 'craft-impactful-cv',
    track: 'careers',
    title: 'Craft an Impactful CV',
    subtitle: 'Stand out in Africa\'s social impact sector',
    description: 'A 19-lesson course that takes you from a generic CV to a powerful, values-driven document that gets you noticed by purpose-driven employers across Africa.',
    lessons: 19,
    duration: '90 min',
    difficulty: 'Beginner',
    free: true,
    badge: 'cv-ready',
    colour: '#4C9F38',
    icon: '📄',
    lessons_data: [

      /* ── LESSON 1: Poll ── */
      {
        id: 1, title: 'What do you struggle with most?', mins: 2, type: 'poll', icon: '💬',
        poll: {
          question: 'What do you struggle with most when it comes to writing your CV?',
          hint: 'Choose as many as you like',
          multi: true,
          options: [
            'Making my CV feel personal and values-driven',
            'Describing my experience clearly and concisely',
            'Formatting it in a clean, professional way',
            'Writing a strong summary or personal statement',
            'Knowing what to include (and what to leave out)',
            'Staying honest without underselling myself',
            'Tailoring it for different jobs',
            'Feeling like I don\'t have enough relevant experience',
          ],
        },
        takeaway: 'You\'re not alone. Most professionals in the impact sector face the same challenges. This course addresses every single one of them.',
      },

      /* ── LESSON 2: What a CV Is (and Isn't) ── */
      {
        id: 2, title: 'What a CV Is, and What It Isn\'t', mins: 5, type: 'read', icon: '📌',
        content: `Before we start editing or writing, it\'s important to understand the purpose of a CV, especially in the social impact space.

✅ **A CV is:**

- A **curated story of your experience**, tailored to the role you want
- A **snapshot of your skills and impact**, not a full career diary
- A **tool to get you an interview**, not the job itself
- An **evolving document**, not something you write once and forget
- A reflection of your **purpose and values**, especially in roles where mission matters

❌ **A CV isn't:**

- A full biography or list of every task you\'ve ever done
- A generic document you send unchanged to multiple jobs
- A place for exaggeration: honesty is essential, especially in values-led work
- A writing test: it should be easy to read, not overly formal or long`,
        takeaway: 'Your CV is a curated, values-driven story — not a job history. It exists to get you an interview, nothing more.',
        quiz: {
          q: 'What is the primary purpose of a CV?',
          options: ['To tell your full life story','To get you an interview','To prove you are qualified','To impress your current employer'],
          answer: 1,
        },
      },

      /* ── LESSON 3: What Employers Look For ── */
      {
        id: 3, title: 'What Impact Employers Look For', mins: 5, type: 'read', icon: '💡',
        content: `A strong CV doesn\'t list everything. It highlights what\'s *most relevant*. In the social impact sector, your **story, values, and outcomes** matter more than job titles or buzzwords. Particularly, purpose-driven employers look for:

- Alignment with their **mission or cause**
- Evidence of **community, policy, or systems-level thinking**
- **Transferable skills**, even from other industries
- **Clear impact**, not just duties or responsibilities

**Why this matters for you**

Most CVs in the sector are written the same way — a reverse-chronological list of roles with generic bullet points. The professionals who stand out are those who frame their experience through the lens of *what changed because of their work*.

You don\'t need 10 years of experience at a top NGO. You need to **tell the right story clearly.**`,
        takeaway: 'Impact employers care about mission alignment and what changed because of your work — not just what your job title was.',
        quiz: {
          q: 'What do purpose-driven employers prioritise most on a CV?',
          options: ['Job titles and years of experience','Clear impact and mission alignment','Academic qualifications','Number of organisations worked for'],
          answer: 1,
        },
      },

      /* ── LESSON 4: Sliding Scale ── */
      {
        id: 4, title: 'How do you feel about your CV?', mins: 1, type: 'scale', icon: '🎯',
        scale: {
          question: 'On a scale of 1–10, how confident are you in your current CV?',
          min: 1, max: 10,
          minLabel: 'Needs major work',
          maxLabel: 'Job-ready and proud',
        },
        takeaway: 'Wherever you are right now is the perfect starting point. By the end of this course, you\'ll move that number significantly.',
      },

      /* ── LESSON 5: The Harsh Truth ── */
      {
        id: 5, title: 'The Harsh Truth', mins: 4, type: 'read', icon: '⏱',
        content: `Here\'s something most people don\'t know: **recruiters spend an average of 6–10 seconds** scanning a CV before deciding whether to read further.

That\'s not a typo. Six to ten seconds.

**What this means for you**

Your CV needs to communicate its core message *instantly*. If a recruiter can\'t understand who you are and what you\'ve done in the first glance, your application is gone.

**What recruiters look for in those 6 seconds:**
- Your name and contact information
- Your most recent role and organisation
- A strong opening statement or summary
- Recognisable organisations or achievements
- Clean, easy-to-scan formatting

**The good news**

This is fixable. By focusing on clarity, formatting, and impact language — all things we\'ll cover in this course — you can immediately improve how your CV reads in those first crucial seconds.`,
        takeaway: 'Recruiters decide in 6–10 seconds. Your CV must be instantly clear, well-formatted, and impact-led.',
        quiz: {
          q: 'On average, how long do recruiters spend on a first scan of a CV?',
          options: ['15 minutes','2 minutes','6–10 seconds','30 seconds'],
          answer: 2,
        },
      },

      /* ── LESSON 6: Why Storytelling Belongs in a CV ── */
      {
        id: 6, title: 'Why Storytelling Belongs in a CV', mins: 5, type: 'read', icon: '📚',
        content: `Your CV is more than a list of jobs — it\'s a curated narrative. In the social impact sector, people want to know:

- What kind of problems you\'ve helped solve
- What kind of impact you\'ve made

Storytelling is what turns a job description into a contribution, and it\'s what helps mission-driven employers see your potential. **Your CV should not be a list of tasks — it should be a list of achievements.**

**How to tell your story on a CV**

Instead of: *"Responsible for community outreach"*
Write: *"Led community outreach programme that engaged 1,200 residents across 4 districts, increasing programme enrolment by 35%."*

Instead of: *"Supported grant writing"*
Write: *"Co-authored a £150,000 grant proposal that secured 3 years of funding for a youth employability programme."*

The difference? The first tells what your *role* was. The second tells what *happened because you were there.*

**The formula: Action + Context + Result**

Every bullet point on your CV should follow this structure:
- **Action**: What did you do? (Use a strong verb: led, designed, secured, launched...)
- **Context**: For whom, where, or in what setting?
- **Result**: What changed? What was the measurable outcome?`,
        takeaway: 'Replace task-based language with story-based language: Action + Context + Result. Every bullet point should answer "what changed because of me?"',
        quiz: {
          q: 'What structure should your CV bullet points follow?',
          options: ['Role + Responsibility + Years','Action + Context + Result','Title + Duty + Skills','Team + Project + Date'],
          answer: 1,
        },
      },

      /* ── LESSON 7: The CV Blueprint ── */
      {
        id: 7, title: 'The CV Blueprint: What to Include', mins: 8, type: 'read', icon: '🗂',
        content: `Here\'s a breakdown of the core elements you\'ll need, especially in purpose-driven roles:

📌 **What to include (and how):**

**[OPTIONAL] Summary/Profile (2–3 lines)**
What is your qualification? What is your superpower? Make it purpose-led and clear. You can include your background, industry, years of experience, your superpower and an accolade or exceptional career milestone.

**Experience**
Focus on relevant experience for the role you are applying for. Do not list all of your experience. Remember, your CV is not a full biography or list of every task you\'ve ever done. Use **action + outcome** language. Don\'t say "responsible for", but: *"Led a community engagement project that reached 500+ residents."*

**Skills**
Focus on sector-relevant and transferable skills, e.g. stakeholder engagement, DEI facilitation, fundraising, project coordination. If you decide to add software, be sure to add niche ones (e.g. Adobe Illustrator) instead of generic ones (Microsoft Word).

**Voluntary Work or Side Projects**
These matter *a lot*. In social impact, informal or unpaid experience is often just as valuable. List relevant voluntary work or side projects using the same format as your "Experience" section.

**Education & Certifications**
Keep it concise and relevant — highlight training that speaks to your values or sector knowledge.

---
In the resources section, you will find links to downloadable CV templates according to your level.

Have any questions? Message them in the comments section and our team will get back to you!`,
        takeaway: 'A strong impact CV includes: Summary, Experience (action + outcome), Skills, Voluntary Work, and Education. Quality over quantity — every line earns its place.',
        quiz: {
          q: 'Why is voluntary work important to include on an impact sector CV?',
          options: ['It fills space','Informal and unpaid experience can be just as valuable as paid roles','It shows you work for free','Employers require it'],
          answer: 1,
        },
      },

      /* ── LESSON 8: Format Matters ── */
      {
        id: 8, title: 'Format Matters: Length, Layout and Clarity', mins: 5, type: 'read', icon: '✏️',
        content: `A brilliant experience described in a cluttered, hard-to-read format will still lose out to a simpler CV that\'s easy to scan. Here\'s what to know:

**Length**
- **0–5 years experience**: 1 page maximum
- **5–15 years experience**: 1–2 pages
- **15+ years or academic roles**: 2–3 pages

Never pad. If you can say it clearly in 1 page, don\'t stretch it to 2.

**Formatting principles**
- Use a clean, professional font (Calibri, Arial, or Georgia at 10–12pt)
- Use consistent spacing and alignment — messy CVs signal carelessness
- Use bold sparingly to highlight key achievements, not everything
- Left-align text — centred CVs are harder to scan
- Use PDF format when submitting — formatting stays intact

**What to avoid**
- Photos (unless specifically requested — common in some African markets)
- Tables and columns that break when exported
- Coloured backgrounds or excessive design elements
- Long paragraphs — use bullet points instead
- Generic phrases: "team player", "results-oriented", "passionate"

**ATS (Applicant Tracking Systems)**
Many organisations — especially international NGOs and larger employers — use software to scan CVs before a human sees them. Use standard headings ("Experience", "Education") and avoid text in headers/footers.`,
        takeaway: 'Keep your CV clean, scannable and appropriately concise. Format is not decoration — it\'s communication.',
        quiz: {
          q: 'What file format should you use when submitting a CV?',
          options: ['Word document (.docx)','PDF','Google Doc link','Plain text (.txt)'],
          answer: 1,
        },
      },

      /* ── LESSON 9: Free Templates ── */
      {
        id: 9, title: 'Your Free CV Templates', mins: 2, type: 'link', icon: '📎',
        content: `We\'ve created downloadable CV templates specifically designed for Africa\'s social impact sector — from entry-level to senior consultant.

Choose the template that matches your experience level:
- **Entry Level Changemaker** — 0–3 years
- **Impact Professional** — 3–10 years (2-page format)
- **Consultant / Freelance** — for project-based and independent professionals
- **Senior Leader** — for director-level and above

Each template is clean, ATS-friendly, and formatted to showcase impact over tasks.`,
        link: {
          url: 'templates.html',
          label: '📥 Download free CV templates',
          openNewTab: true,
        },
        takeaway: 'Use a template as a starting point, not a straightjacket. The content you put in it is what matters.',
      },

      /* ── LESSON 10: Not Just What You Did ── */
      {
        id: 10, title: 'Not Just What You Did, But What Changed', mins: 6, type: 'read', icon: '📣',
        content: `Recruiters don\'t just want to know that you did a task — they want to know the *difference* it made. People are naturally attracted to numbers, so make sure to quantify achievements and add significant information in bold.

❌ **Don\'t just write:**
- "Organised community events"
- "Managed programme budget"

✅ **Instead, write:**
- "Organised **12+ community events**, reaching **1,500 attendees** and increasing local engagement by **40%**"
- "Managed **£250K programme budget**, reducing expenses by 18% while increasing reach"

**How to quantify when you don\'t have exact numbers**

You won\'t always have precise data. That\'s OK. Use estimates:
- "Supported approximately 200 beneficiaries per quarter"
- "Contributed to a team that secured over $500K in grants annually"
- "Reduced reporting time by roughly 30% through process improvements"

Approximate numbers are still far more compelling than no numbers at all.

**Finding your achievements**

Ask yourself for each role:
- What changed because I was there?
- What would have been harder, slower or worse without me?
- What am I most proud of?

Those are your bullet points.`,
        takeaway: 'Quantify everything you can. Numbers — even approximate ones — are more compelling than vague descriptions of duties.',
        quiz: {
          q: 'What should you do when you don\'t have exact numbers for an achievement?',
          options: ['Leave the achievement out','Make up a number','Use an honest estimate','Write "results pending"'],
          answer: 2,
        },
      },

      /* ── LESSON 11: Templates Revisited ── */
      {
        id: 11, title: 'Resources: Templates & Examples', mins: 2, type: 'link', icon: '📋',
        content: `Before you do the next exercise, it\'s helpful to have a template open alongside you. Our templates include example bullet points written in the Action + Context + Result format that you can use as inspiration.

Don\'t copy them — use them as a model to rewrite your own experience in a stronger way.`,
        link: {
          url: 'templates.html',
          label: '📥 Open CV templates in new tab',
          openNewTab: true,
        },
        takeaway: 'Great CVs are built by iteration — draft, refine, and test against real job descriptions.',
      },

      /* ── LESSON 12: Try It Yourself ── */
      {
        id: 12, title: 'Try It Yourself!', mins: 5, type: 'exercise', icon: '✍️',
        prompt: 'Think about one bullet point on your current CV that could use more detail. Rewrite it using the Action + Context + Result formula:',
        hint: 'Don\'t worry — this won\'t be shared with anyone. Research shows that actively applying what you learn leads to better retention and understanding.',
        placeholder: 'e.g. "Led a community engagement programme that reached 500+ residents across 3 districts, increasing local participation by 35%"',
        takeaway: 'The act of writing it out — even imperfectly — trains your brain to think in impact language. You can refine it later.',
      },

      /* ── LESSON 13: Mission: Practice Impact Writing ── */
      {
        id: 13, title: 'Mission: Practice Impact Writing', mins: 8, type: 'read', icon: '🖊',
        content: `It\'s time to start editing the content of your CV!

**1. Rewrite 1–2 bullet points using this formula:**

**Action verb + context + result**

*Examples of strong action verbs:*
Led · Designed · Secured · Launched · Trained · Managed · Developed · Coordinated · Implemented · Advocated · Facilitated · Delivered

**2. Then do a quick sanity check:**
- Is it accurate?
- Could I back this up in an interview?
- Would a colleague describe it in the same way?

**3. Read it aloud**
If it sounds awkward or overly formal, it probably reads that way too. Your CV should sound like a confident, honest version of you.

This isn\'t about "selling yourself" — it\'s about **showing your impact clearly and truthfully.**

**Common mistakes to avoid**
- Starting bullet points with "Responsible for..." (passive — rewrite it!)
- Using buzzwords with no evidence ("passionate", "dynamic", "results-driven")
- Describing team achievements as if you did them alone — be honest, say "contributed to" or "co-led"
- Listing duties instead of achievements`,
        takeaway: 'Go rewrite 1–2 bullet points right now using Action + Context + Result. Don\'t aim for perfection — aim for honesty and clarity.',
        quiz: {
          q: 'Which of these bullet points is written most effectively?',
          options: [
            'Responsible for community outreach and stakeholder management',
            'Was part of a team that did community events',
            'Led 8 community outreach events reaching 2,000+ residents, increasing programme enrolment by 28%',
            'Passionate about community development and impact',
          ],
          answer: 2,
        },
      },

      /* ── LESSON 14: Key Learnings So Far ── */
      {
        id: 14, title: 'Key Learnings So Far', mins: 4, type: 'read', icon: '🔄',
        content: `You\'ve done incredible work so far. Before we dive into the next section, let\'s take a moment to recap what we\'ve learned:

**Takeaway 1**
You explored what a CV *is* (a focused, values-led story) and what it *isn\'t* (a full biography or a place for exaggeration). You reflected on what you find difficult, and realised that most people do.

**Takeaway 2**
You learned the importance of **structure** and **storytelling**. You saw that your CV isn\'t just a list of tasks — it\'s a narrative that connects your skills and your impact.

**Takeaway 3**
You began rewriting your bullet points to focus on **impact** using action verbs and honest language, making your contributions clearer and more confident.

**Where we\'re going next**

The second half of this course focuses on **tailoring** — the skill that separates good CVs from great ones. We\'ll look at how to adapt your CV for specific roles, how to pass automated screening, and how to make sure every application feels like it was written just for that job.`,
        takeaway: 'You\'ve built the foundation: a values-led story with impact-driven language. Now it\'s time to learn how to tailor it.',
        quiz: {
          q: 'What is the focus of the second half of this course?',
          options: ['Writing longer bullet points','Tailoring your CV for specific roles','Adding more qualifications','Changing your CV design'],
          answer: 1,
        },
      },

      /* ── LESSON 15: Poll — Do You Tailor? ── */
      {
        id: 15, title: 'Do you tailor your CV?', mins: 1, type: 'poll', icon: '💬',
        poll: {
          question: 'Tell us the truth: do you currently tailor your CV for each application?',
          hint: 'Select one',
          multi: false,
          options: [
            'Yes, always — I adapt it every time',
            'Sometimes — if I have enough time',
            'Rarely — I send mostly the same version',
            'No — I use one CV for everything',
          ],
        },
        takeaway: 'Most people don\'t tailor consistently — and most people don\'t get interviews consistently. The next lessons will change that.',
      },

      /* ── LESSON 16: Mission: Tailor Your CV ── */
      {
        id: 16, title: 'Mission: Tailor Your CV for a Real Job', mins: 10, type: 'read', icon: '🖊',
        content: `📝 **Mission: Tailor Your CV for a Real Job**

**1. Choose one job you\'d be excited to apply for.**

Tip: try looking at our [opportunities page](opportunities.html) to find a real role you might be interested in.

**2. Use the job description to spot keywords.**

Some recruiters use automated systems (called ATS — Applicant Tracking Systems) to filter CVs by matching keywords. You want to be sure that you highlight key technical competencies or language from the job description so that you pass the ATS if it is used.

You can use AI tools to help identify these keywords, but try to think for yourself first. It\'s great practice and helps you engage more deeply with the role.

**3. Adapt your CV to align with it. Focus on:**
- Your personal statement
- 3–4 bullet points that show impact and relevance
- The order of your sections (highlight voluntary work if it\'s especially relevant)

**4. Final check:**
- Does my summary speak directly to this organisation\'s goals or values?
- Have I highlighted the most relevant skills and experiences for this specific role?
- Am I using similar language to the job description, without just copying it?

If so, it is time to get it proofread by a friend or someone you trust before applying for your dream role!`,
        takeaway: 'Tailoring is not optional — it\'s the difference between a generic application and one that feels written just for that role.',
        quiz: {
          q: 'What is the main purpose of tailoring your CV for each job?',
          options: [
            'To make it look like you have more experience',
            'To show alignment with the role and pass ATS screening',
            'To make the document longer',
            'To impress the recruiter with design',
          ],
          answer: 1,
        },
      },

      /* ── LESSON 17: CV Analyser ── */
      {
        id: 17, title: 'Boost Your CV — No Wahala Style', mins: 5, type: 'cv-analyser', icon: '⭐',
        content: `Now that your CV is taking shape, it\'s time to put it through the **No Wahala CV Booster** — Afrorama\'s free AI-powered CV scorer built specifically for Africa\'s social impact sector.

**What it does:**
- Scores your CV out of 100 against sector-specific criteria
- Highlights your strongest sections
- Gives you personalised recommendations
- Tracks your improvement over multiple uploads

**How many free analyses do you get?**
You get **10 free analyses** as part of this course. After that, you can unlock unlimited analyses with an Afrorama membership or a one-time boost purchase.

**How to use it:**
1. Export your CV as a PDF
2. Click the button below to open the CV Booster
3. Upload your CV and review your score
4. Come back to this lesson and mark it complete`,
        link: {
          url: 'cv-analyser.html',
          label: '⭐ Open No Wahala CV Booster',
          openNewTab: true,
        },
        takeaway: 'A scored CV gives you a clear, objective baseline — and a clear path to improvement.',
      },

      /* ── LESSON 18: Rate Us on Trustpilot ── */
      {
        id: 18, title: 'Help Others Find Us', mins: 1, type: 'link', icon: '⭐',
        content: `You\'re almost there! Before you complete the course, we\'d love to hear what you thought.

If this course has helped you, leaving a quick review on Trustpilot takes less than 2 minutes — and it helps other African professionals find Afrorama and access the same resources you just did.

Every review genuinely makes a difference to a small, mission-driven team.`,
        link: {
          url: 'https://www.trustpilot.com/review/afrorama.org',
          label: '⭐ Leave a Trustpilot review',
          openNewTab: true,
        },
        takeaway: 'Paying it forward is part of the Afrorama spirit. Your review helps the next changemaker find us.',
      },

      /* ── LESSON 19: Course Complete ── */
      {
        id: 19, title: '🎓 Course Complete!', mins: 1, type: 'completion', icon: '🎓',
        content: `You\'ve done it! You\'ve completed **Craft an Impactful CV** — and you now have the knowledge and tools to create a CV that stands out in Africa\'s social impact sector.

**What you\'ve achieved:**
- ✅ Understood what makes a powerful impact CV
- ✅ Learned the Action + Context + Result formula
- ✅ Structured your CV for ATS and human readers
- ✅ Practised rewriting bullet points with impact language
- ✅ Learned how to tailor your CV for every application
- ✅ Run your CV through the No Wahala CV Booster

**What\'s next?**
- Browse live opportunities on our [opportunities page](opportunities.html)
- Join the [community](community.html) to get CV feedback from peers
- Upgrade to membership for unlimited CV analyses and access to more courses`,
        takeaway: 'Your CV is a living document. Keep updating it as you grow, and re-score it each time you make a major change.',
      },
    ],
  },

  /* ══════════════════════════════════════════════════
     ROAD TO FINANCIAL FREEDOM
  ══════════════════════════════════════════════════ */
  {
    id: 'road-to-financial-freedom',
    track: 'finance',
    title: 'Road to Financial Freedom',
    subtitle: 'Build a financial system that sets you free',
    description: 'A practical, empowering course that helps you build a financial system giving you stability, peace of mind and the ability to choose yourself. Includes the 50/30/20 method and the powerful Uhuru Fund concept.',
    lessons: 20,
    duration: '75 min',
    difficulty: 'Beginner',
    free: true,
    badge: 'money-minded',
    colour: '#DDA63A',
    icon: '💰',
    lessons_data: [

      /* ── LESSON 1: Welcome ── */
      {
        id: 1, title: 'Welcome to Your Financial Journey', mins: 3, type: 'read', icon: '💰',
        content: `Welcome to your road to financial empowerment. 🎉

The aim of this course is simple but powerful: **to help you build a financial system that gives you stability, peace of mind and the ability to choose yourself.**

Not your employer. Not your circumstances. **You.**

Whether you're starting from scratch, trying to break a cycle of financial stress, or just looking for a clearer system — you're in the right place.

**What you'll learn:**
- How to build a budget you'll actually stick to
- The 50/30/20 rule that makes managing money simple
- The Uhuru Fund — your personal freedom savings
- How to calculate exactly how much freedom money you need
- How to build your budget step by step

**Are you ready to join this journey?**

Let's go. 🚀

---
⚠️ **Disclaimer:** Afrorama provides educational content only. We do not offer financial advice, financial planning services or recommendations. All information is for learning purposes and should not be taken as guidance specific to your personal financial situation. Please consult a qualified financial professional for advice tailored to your circumstances.`,
        takeaway: 'Financial freedom isn\'t a destination reserved for the wealthy — it\'s a system anyone can build, one step at a time.',
      },

      /* ── LESSON 2: Poll — Budget? ── */
      {
        id: 2, title: 'Quick check-in: your finances today', mins: 2, type: 'poll', icon: '💬',
        poll: {
          question: 'Do you currently have a monthly budget?',
          hint: 'Be honest — no judgement here!',
          multi: false,
          options: [
            'Yes, I have a budget and I follow it',
            'Yes, I have one but I don\'t really stick to it',
            'Not really — I track loosely in my head',
            'No budget at all',
          ],
        },
        takeaway: 'Wherever you are right now is your starting point — not your finishing line. Most people have never been taught how to budget properly.',
      },

      /* ── LESSON 3: Scale — Confidence ── */
      {
        id: 3, title: 'How are you feeling about money?', mins: 1, type: 'scale', icon: '🎯',
        scale: {
          question: 'On a scale of 1–10, how confident do you currently feel about managing your monthly finances?',
          min: 1, max: 10,
          minLabel: 'Completely lost',
          maxLabel: 'Totally in control',
        },
        takeaway: 'By the end of this course, you\'ll be able to answer this question with a much higher number — and you\'ll know exactly why.',
      },

      /* ── LESSON 4: Exercise — What Would You Change? ── */
      {
        id: 4, title: 'What would you change?', mins: 3, type: 'exercise', icon: '✍️',
        prompt: 'If you could change one thing about your current financial situation, what would it be — and why?',
        hint: 'This is just for you. Writing it down helps you get clear on what you\'re working towards.',
        placeholder: 'e.g. "I\'d save more consistently because I always feel anxious when unexpected expenses come up..."',
        takeaway: 'Naming what you want to change is the first act of financial empowerment. You\'ve already started.',
      },

      /* ── LESSON 5: The First Step ── */
      {
        id: 5, title: 'The First Step: Know What\'s In Your Budget', mins: 4, type: 'read', icon: '🔍',
        content: `Before you can manage money, you need to **see** your money clearly.

Most people avoid looking at their finances closely because it can feel overwhelming or even shameful. But here's the truth: **you can\'t fix what you can\'t see.**

**What a budget actually is**

A budget isn\'t a punishment. It isn't a list of things you can\'t have. A budget is simply a **plan for your money** — a set of instructions you give it before the month begins.

Without a budget, your money decides where it goes. With a budget, *you* decide.

**The most important mindset shift**

Stop trying to remember your spending. Start recording it. Your brain is not built to track dozens of small transactions — your phone or a spreadsheet is.

**This week\'s challenge:** Look at your last month of bank transactions or mobile money history. Don't judge — just observe. Where did your money actually go?`,
        takeaway: 'You can\'t manage what you don\'t measure. The first step is simply looking — with curiosity, not judgement.',
      },

      /* ── LESSON 6: Poll — Sticking to Budget ── */
      {
        id: 6, title: 'Be honest with us…', mins: 1, type: 'poll', icon: '💬',
        poll: {
          question: 'Do you struggle to stick to a monthly budget?',
          hint: 'Pick the one that resonates most',
          multi: false,
          options: [
            'Not at all — it\'s easy peasy 🙌',
            'I struggle, but I still manage',
            'Budget… what budget? 😅',
          ],
        },
        takeaway: 'If you picked option 2 or 3 — you\'re in the majority. The next lesson will change everything.',
      },

      /* ── LESSON 7: The 50/30/20 Rule ── */
      {
        id: 7, title: 'The Rule That Changes Everything', mins: 6, type: 'read', icon: '📊',
        chartHtml: `<div style="display:flex;gap:10px;margin:24px 0;flex-wrap:wrap;">
  <div style="flex:1;min-width:110px;background:#3F7E44;color:white;border-radius:16px;padding:20px 14px;text-align:center;border:2.5px solid #1C1D1C;box-shadow:3px 3px 0 #1C1D1C;">
    <div style="font-size:2.8rem;font-weight:900;line-height:1;">50%</div>
    <div style="font-weight:800;margin-top:8px;font-size:1rem;">Needs</div>
    <div style="font-size:.75rem;opacity:.9;margin-top:4px;line-height:1.4;">Rent · Food · Bills · Transport</div>
  </div>
  <div style="flex:1;min-width:110px;background:#26BDE2;color:white;border-radius:16px;padding:20px 14px;text-align:center;border:2.5px solid #1C1D1C;box-shadow:3px 3px 0 #1C1D1C;">
    <div style="font-size:2.8rem;font-weight:900;line-height:1;">30%</div>
    <div style="font-weight:800;margin-top:8px;font-size:1rem;">Wants</div>
    <div style="font-size:.75rem;opacity:.9;margin-top:4px;line-height:1.4;">Dining · Travel · Joy · Hobbies</div>
  </div>
  <div style="flex:1;min-width:110px;background:#DDA63A;color:white;border-radius:16px;padding:20px 14px;text-align:center;border:2.5px solid #1C1D1C;box-shadow:3px 3px 0 #1C1D1C;">
    <div style="font-size:2.8rem;font-weight:900;line-height:1;">20%</div>
    <div style="font-weight:800;margin-top:8px;font-size:1rem;">Freedom</div>
    <div style="font-size:.75rem;opacity:.9;margin-top:4px;line-height:1.4;">Savings · Uhuru Fund · Investing</div>
  </div>
</div>`,
        content: `If budgets have ever felt restrictive or unrealistic, it's time to try the **50/30/20 rule.** It is simple, flexible and it will change your relationship with money.

The 50/30/20 rule divides your **after-tax income** into three categories. It helps you tell your money where to go — instead of wondering where it went.

**Why it works**

Most budgeting systems fail because they're too complicated or too rigid. The 50/30/20 rule is flexible enough to adapt to your life, specific enough to give you structure, and simple enough to remember without a spreadsheet open.

**The golden principle:** Pay yourself first. Before spending on anything else, allocate your 20% to savings. Automate it if you can — make it invisible.`,
        takeaway: 'The 50/30/20 rule is the most practical budgeting framework for most people. Simple, flexible, and powerful.',
      },

      /* ── LESSON 8: 50% Needs ── */
      {
        id: 8, title: '50% — Your Needs', mins: 4, type: 'read', icon: '🏠',
        content: `Half of your after-tax income goes to **essential living expenses** — the things you genuinely need to survive and function.

**What counts as a Need:**
- Rent or housing costs
- Utilities (electricity, water, internet)
- Groceries and household supplies
- Transportation to work
- Insurance and medical costs
- Minimum debt repayments

**Example:** If you earn $1,000 a month, **$500 goes to needs.**

**A reality check**

Your needs may currently take up more than 50% of your income. For many people — especially in expensive cities or on lower incomes — this is completely normal.

Don't panic. Start where you are. Look for small opportunities to reduce costs: meal prepping, reviewing subscriptions, negotiating bills.

**The goal isn't perfection** — it's awareness. Once you know what your needs actually cost, you have the power to make informed decisions.`,
        takeaway: 'Needs are non-negotiable expenses. Start by listing them — the act of seeing them clearly is the first step to managing them.',
      },

      /* ── LESSON 9: 30% Wants ── */
      {
        id: 9, title: '30% — Your Wants (Yes, They Count!)', mins: 4, type: 'read', icon: '🎉',
        content: `Here's the part most budgets get wrong: **life should include joy.** The 50/30/20 rule doesn't ask you to eliminate fun — it gives you *permission* to enjoy it, within a healthy structure.

**What counts as a Want:**
- Eating out and social activities 🍽️
- Travel and weekend getaways ✈️
- Hobbies and personal interests
- Streaming subscriptions and entertainment
- Gym membership or wellness
- Beauty and self-care
- Clothes beyond the basics
- Gifts and celebrations

**Example:** With a $1,000 income, **$300 goes to wants.**

**An important nuance**

Your wants are personal. For some, the gym is a want. For others, it's essential for mental wellbeing. There's no universal list — this is *your* budget.

If you already spend more than 30% on wants, don't panic. Do a gentle audit: what brings you real joy vs. what's just habit or impulse?

**The 24-hour rule:** Before making an unplanned purchase, wait 24 hours. If you still want it, it's probably worth it. If you forget about it — you just saved yourself some money. 💪`,
        takeaway: 'Wants aren\'t the enemy of financial freedom. Unplanned, unconscious spending is. 30% for joy — guilt-free — is part of the plan.',
      },

      /* ── LESSON 10: 20% Uhuru Fund Intro ── */
      {
        id: 10, title: '20% — Meet Your Uhuru Fund', mins: 4, type: 'read', icon: '🕊️',
        content: `This is where things get powerful. The final 20% is your **future-building category** — and it has a name that matters.

**What goes in your 20%:**
- Your **Uhuru Fund** (we'll explain in a moment)
- Emergency savings
- Investments
- Debt repayments beyond the minimum
- Long-term goals: house deposit, business seed money, education

**Example:** With a $1,000 income, **$200 goes to your future.**

**Why this 20% matters most**

The first two categories keep you alive and happy *today*. This 20% builds your ability to *choose* tomorrow.

Even $50 a month invested consistently can grow into something significant. Even $20 a month in emergency savings means you won't spiral into debt next time your phone screen breaks or your car needs a repair.

But the most important thing you can build inside this 20%? Your **Uhuru Fund.** ⬇️`,
        takeaway: 'The 20% is the category that transforms your financial life. It\'s small enough to start, and powerful enough to change everything.',
      },

      /* ── LESSON 11: The Uhuru Fund ── */
      {
        id: 11, title: 'The Uhuru Fund: Your Freedom Money', mins: 6, type: 'read', icon: '🕊️',
        content: `There are moments in life when something just doesn\'t feel right anymore — yet we stay because we feel financially trapped.

Maybe it\'s a job that\'s affecting your wellbeing. A living situation that feels unsafe. A relationship that no longer protects your peace. The thought of leaving feels impossible — not because you don\'t want to go, but because you don\'t feel financially able.

**This is exactly what the Uhuru Fund exists to change.**

*Uhuru* means **freedom** in Swahili. And that is exactly what this fund represents.

It is the quiet but powerful ability to say: **"I can walk away if I need to. I am not stuck."**

---

**What the Uhuru Fund gives you:**

🧠 **Confidence** — You make decisions from a place of strength, not fear.

🛡️ **Safety** — You have options if work or life becomes unhealthy.

🌍 **Freedom** — You can pivot, pause, travel, adjust or reset.

☮️ **Peace** — Your wellbeing is not dependent on someone else\'s choices.

---

Your Uhuru Fund isn\'t about expecting the worst. It\'s about being prepared for the full range of life — the unexpected setbacks *and* the exciting opportunities you haven\'t imagined yet.`,
        takeaway: 'The Uhuru Fund is your financial backbone — the quiet confidence of knowing you have options, no matter what life throws at you.',
      },

      /* ── LESSON 12: When to Use It ── */
      {
        id: 12, title: 'When to Use Your Uhuru Fund', mins: 5, type: 'read', icon: '🌱',
        content: `Your Uhuru Fund is there for the moments when you need to **choose yourself.** Here are real situations where it gives you the power to act:

**Leaving difficult situations:**
- Walking away from a toxic workplace that has affected your wellbeing
- Moving out of a home environment that feels unsafe or overwhelming
- Ending a relationship that no longer protects your peace
- Stopping work with a client or project that consistently drains your energy
- Dealing with a landlord who refuses to address serious issues — and being able to move without financial fear

**Creating positive transitions:**
- Taking time off to rest, travel or reset your life
- Starting a business or stepping into freelance work
- Changing careers or relocating to a new city
- Taking a sabbatical or investing in personal growth
- Building a passion project or exploring an opportunity that inspires you

---

**One important reminder**

Your Uhuru Fund is not for everyday expenses, holidays or treats. Those have their own categories. The Uhuru Fund is sacred — it\'s your insurance against having to stay somewhere that costs you your wellbeing.

Guard it. Grow it. And know that having it is already an act of self-respect.`,
        takeaway: 'The Uhuru Fund is for moments when you need to choose yourself — in crisis and in opportunity alike.',
      },

      /* ── LESSON 13: Where to Store It ── */
      {
        id: 13, title: 'Where to Keep Your Uhuru Fund', mins: 4, type: 'read', icon: '🏦',
        content: `Knowing *where* to keep your Uhuru Fund matters as much as building it. Get this right and your money stays safe, accessible and not tempting.

**Your Uhuru Fund should be:**

✅ **Easy to access** — Not locked away for years. You need to be able to reach it within a day or two if necessary.

✅ **Separate from your daily account** — If it lives alongside your spending money, you *will* spend it. Keep it in a different account you don\'t check daily.

✅ **Low risk and stable** — This is not investing money. Invested money can fall in value and may not be accessible immediately. Your Uhuru Fund needs to be there when you need it.

---

**Good options:**
- A dedicated savings account (separate bank or sub-account)
- A mobile money savings feature (e.g. M-Pesa lock savings, Ecocash)
- A credit union savings account
- A fixed deposit with early withdrawal available

**What to avoid:**
- Investing your Uhuru Fund in stocks, crypto or volatile assets
- Keeping it in your main account where you\'ll spend it
- Locking it away in a long-term product you can\'t access quickly`,
        takeaway: 'Keep your Uhuru Fund separate, accessible, and stable. It\'s not a growth investment — it\'s your freedom insurance.',
      },

      /* ── LESSON 14: How Much to Save ── */
      {
        id: 14, title: 'How Much Is Enough?', mins: 4, type: 'read', icon: '🔢',
        content: `The general guideline for your Uhuru Fund:

| Your situation | Target amount |
|---|---|
| Employed full-time | 3–6 months of essential living costs |
| Self-employed or freelance | 9 months of essential living costs |
| Planning a major life change | 12 months of essential living costs |

---

**How to calculate your personal target:**

1. Add up your monthly **needs** (rent, food, transport, utilities, insurance)
2. Multiply by your target number of months
3. That\'s your Uhuru Fund goal

**Example:** Monthly needs = $600. Target = 4 months. Uhuru Fund goal = **$2,400.**

---

**The most important thing:** You do not need to save this amount all at once.

Start with what you can. Even **$5 a month** is a real start. The habit of saving consistently matters more than the amount in the early stages. Every single deposit — however small — is an act of choosing yourself.

Set a monthly automatic transfer to your Uhuru Fund account on payday. Before you can spend it, move it. Make freedom automatic.`,
        takeaway: 'Your Uhuru Fund target is 3–12 months of essential costs. Start small, stay consistent. Every deposit counts.',
      },

      /* ── LESSON 15: Build Your Budget ── */
      {
        id: 15, title: 'Final Step: Build Your 50/30/20 Budget', mins: 8, type: 'read', icon: '🛠️',
        content: `It\'s time. Let\'s build your actual budget using the 50/30/20 framework. Open the spreadsheet (link below) and follow these three steps:

---

**Step 1: Calculate your after-tax income**

- **Employed?** Check your payslip — use the amount you actually receive after tax and deductions.
- **Freelancer or business owner?** Subtract taxes, business costs and required expenses from your monthly earnings. Be conservative — use an average, not your best month.

---

**Step 2: Categorise your expenses**

Review one month of actual spending — bank statements, mobile money history, receipts. Place each item into:
- **Needs** (50%)
- **Wants** (30%)
- **Savings / Uhuru Fund** (20%)

Don\'t judge what you find. Just categorise it honestly. This single exercise gives most people a genuine "oh wow" moment about where their money has been going.

---

**Step 3: Adjust gradually**

Your numbers probably won\'t fit neatly into 50/30/20 right away. That is completely normal. Every month, make one small adjustment. Small, steady changes create lasting habits — and lasting financial change.

**Remember:** The goal isn\'t perfection. The goal is direction.`,
        takeaway: 'The budget you build today — however imperfect — is more powerful than the perfect budget you never start.',
        link: {
          url: 'templates.html',
          label: '📊 Open your 50/30/20 budget spreadsheet',
          openNewTab: true,
        },
      },

      /* ── LESSON 16: End Reflection Scale ── */
      {
        id: 16, title: 'How do you feel now?', mins: 1, type: 'scale', icon: '📈',
        scale: {
          question: 'How confident do you feel NOW about managing your money using the 50/30/20 method and building your Uhuru Fund?',
          min: 1, max: 10,
          minLabel: 'Still working on it',
          maxLabel: 'Ready to take on the world',
        },
        takeaway: 'Progress, not perfection. Whatever your number, you know more today than you did at the start — and that is everything.',
      },

      /* ── LESSON 17: Poll — Recommend? ── */
      {
        id: 17, title: 'Would you recommend this course?', mins: 1, type: 'poll', icon: '💬',
        poll: {
          question: 'Would you recommend the Road to Financial Freedom course to a friend?',
          hint: 'Be honest — your feedback helps us improve',
          multi: false,
          options: [
            'Absolutely — I already want to share it 🙌',
            'Yes, with a few improvements',
            'Maybe — I\'m not sure yet',
            'No — it wasn\'t for me',
          ],
        },
        takeaway: 'Thank you for your honesty. Every piece of feedback makes this course better for the next person who takes it.',
      },

      /* ── LESSON 18: Poll — Prepared? ── */
      {
        id: 18, title: 'Are you ready to apply this?', mins: 1, type: 'poll', icon: '💬',
        poll: {
          question: 'Do you feel prepared to apply what you\'ve learned to your real-life budgeting and saving?',
          hint: 'One answer only',
          multi: false,
          options: [
            'Yes — I\'m starting this week',
            'Yes — but I\'ll need to review some lessons again',
            'Almost — I have a few questions first',
            'Not yet — still processing',
          ],
        },
        takeaway: 'Starting this week is the only move that matters. Your future self will thank you.',
      },

      /* ── LESSON 19: Exercise — First Action ── */
      {
        id: 19, title: 'Your first financial action', mins: 3, type: 'exercise', icon: '✍️',
        prompt: 'What is the first financial action you plan to take after completing this course — and why is it important to you?',
        hint: 'Write it down and make it real. This is your personal commitment.',
        placeholder: 'e.g. "I\'m going to open a separate savings account this week for my Uhuru Fund, because I want to stop feeling trapped in situations that don\'t serve me..."',
        takeaway: 'Writing a commitment makes it 42% more likely to happen. You\'ve just increased your odds of financial freedom.',
      },

      /* ── LESSON 20: Completion ── */
      {
        id: 20, title: '🎉 You\'re on the road to freedom!', mins: 1, type: 'completion', icon: '💰',
        content: `**2026 = financial freedom.** And you\'re already on your way. 🎉

You\'ve completed the **Road to Financial Freedom** — and you now have a system, not just information.

**What you\'ve achieved:**
- ✅ Understood the 50/30/20 framework
- ✅ Learned what the Uhuru Fund is and why it matters
- ✅ Calculated how much freedom money you need
- ✅ Started building your personal budget
- ✅ Made your first financial commitment

**Get your free budget templates** — use them to put everything you\'ve learned into practice.

**Share your journey**

Help another African professional find financial freedom — share this course with someone who needs it.

*"Get free templates on how to build your budget and embark on your journey to financial freedom."*

**What's next?**
- [Download your budget templates](templates.html) and start tracking
- Join the [community](community.html) — ask questions, share progress
- Browse [opportunities](opportunities.html) — financial freedom and career freedom go hand in hand`,
        takeaway: 'Financial freedom is a journey, not a destination. You\'ve taken the most important step: you\'ve started.',
      },
    ],
  },
];

/* ── STORAGE KEYS ──────────────────────────────────────────── */
const PROGRESS_KEY = 'afrorama_course_progress';
const BADGES_KEY   = 'afrorama_badges';

/* ── STREAK ─────────────────────────────────────────────────── */
function getStreak() {
  try {
    const data = JSON.parse(localStorage.getItem('afrorama_streak') || '{}');
    const today = new Date().toDateString();
    const last  = data.lastDate;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (last === today)      return { count: data.count || 1, updated: false };
    if (last === yesterday)  return { count: (data.count || 0) + 1, updated: true };
    return { count: 1, updated: true };
  } catch { return { count: 1, updated: true }; }
}
function updateStreak() {
  const s = getStreak();
  if (s.updated) {
    const today = new Date().toDateString();
    localStorage.setItem('afrorama_streak', JSON.stringify({ count: s.count, lastDate: today }));
    if (s.count >= 5) {
      const earned = new Set(getEarnedBadges()); earned.add('on-fire');
      localStorage.setItem(BADGES_KEY, JSON.stringify([...earned]));
    }
  }
  return s;
}

/* ── BADGE HELPERS ──────────────────────────────────────────── */
function getEarnedBadges() { try { return JSON.parse(localStorage.getItem(BADGES_KEY) || '[]'); } catch { return []; } }
function hasBadge(id)       { return getEarnedBadges().includes(id); }

/* ── PROGRESS ───────────────────────────────────────────────── */
function getCourseProgress(courseId) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return all[courseId] || { enrolled: false, completed_lessons: [], completed: false };
  } catch { return { enrolled: false, completed_lessons: [], completed: false }; }
}

function markLessonComplete(courseId, lessonId) {
  const all  = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  const cp   = all[courseId] || { enrolled: true, completed_lessons: [], completed: false };
  if (!cp.completed_lessons.includes(lessonId)) cp.completed_lessons.push(lessonId);

  const course = COURSES.find(c => c.id === courseId);
  const isLastLesson = lessonId === course?.lessons_data[course.lessons_data.length - 1].id;
  if (isLastLesson) {
    cp.completed = true;
    // Award course badge
    const earned = new Set(getEarnedBadges());
    const badge  = course?.badge;
    if (badge) earned.add(badge);
    // Award first-step badge
    earned.add('first-step');
    // Check scholar badge (all courses complete)
    const allComplete = COURSES.every(c => {
      const p = all[c.id] || {};
      return p.completed || c.id === courseId;
    });
    if (allComplete) earned.add('scholar');
    localStorage.setItem(BADGES_KEY, JSON.stringify([...earned]));
  } else {
    // Award first-step badge on any lesson completion
    const earned = new Set(getEarnedBadges());
    earned.add('first-step');
    localStorage.setItem(BADGES_KEY, JSON.stringify([...earned]));
  }

  all[courseId] = cp;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  updateStreak();
  return cp;
}

function enrolCourse(courseId) {
  const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  if (!all[courseId]) all[courseId] = { enrolled: true, completed_lessons: [], completed: false };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

window.AfroramaCourses = { COURSES, BADGES, getCourseProgress, markLessonComplete, enrolCourse, getEarnedBadges, hasBadge, getStreak };

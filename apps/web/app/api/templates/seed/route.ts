import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { hasRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import type { Prisma } from "@prisma/client"

// ---------------------------------------------------------------------------
// Starter template definitions
// ---------------------------------------------------------------------------

interface StarterVariable {
  name: string
  label: string
  type: "text" | "date" | "number"
  required: boolean
  defaultValue?: string
}

interface StarterTemplate {
  name: string
  description: string
  contractType: "NDA" | "MSA" | "SOW" | "EMPLOYMENT" | "VENDOR" | "CUSTOMER" | "OTHER"
  variables: StarterVariable[]
  content: Record<string, unknown>
  wordCount: number
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  // ─── 1. Mutual NDA ────────────────────────────────────────────────────────
  {
    name: "Mutual Non-Disclosure Agreement",
    description:
      "Standard mutual NDA for partnerships, vendor intros, and business discussions. Both parties agree to keep each other's information confidential.",
    contractType: "NDA",
    variables: [
      { name: "party_a_name", label: "Party A (Your Company)", type: "text", required: true },
      { name: "party_b_name", label: "Party B (Other Party)", type: "text", required: true },
      { name: "effective_date", label: "Effective Date", type: "date", required: true },
      { name: "term_years", label: "Term (years)", type: "number", required: true, defaultValue: "2" },
      { name: "governing_law", label: "Governing Law (State/Country)", type: "text", required: true, defaultValue: "California" },
    ],
    wordCount: 403,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "MUTUAL NON-DISCLOSURE AGREEMENT" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Mutual Non-Disclosure Agreement (“Agreement”) is entered into as of " },
            { type: "templateVariable", attrs: { variable: "effective_date" } },
            { type: "text", text: ", between " },
            { type: "templateVariable", attrs: { variable: "party_a_name" } },
            { type: "text", text: " (“Party A”) and " },
            { type: "templateVariable", attrs: { variable: "party_b_name" } },
            { type: "text", text: " (“Party B”) (collectively, the “Parties”)." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "1. Confidential Information" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "“Confidential Information” means any non-public information disclosed by either Party to the other Party, either directly or indirectly, in writing, orally, or by inspection of tangible objects, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "2. Obligations" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Each Party agrees to: (a) hold the other Party’s Confidential Information in strict confidence; (b) not disclose such information to any third party without the prior written consent of the disclosing Party; (c) use the Confidential Information solely for evaluating or pursuing a potential business relationship between the Parties; and (d) protect such information using at least the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "3. Exclusions" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "The obligations of confidentiality shall not apply to information that: (a) is or becomes publicly known through no breach of this Agreement; (b) was rightfully known before receipt from the disclosing Party; (c) is independently developed without use of the Confidential Information; or (d) is required to be disclosed by law or court order, provided that the receiving Party gives the disclosing Party prompt written notice.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "4. Term" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Agreement shall remain in effect for " },
            { type: "templateVariable", attrs: { variable: "term_years" } },
            {
              type: "text",
              text: " year(s) from the Effective Date, unless earlier terminated by either Party upon thirty (30) days written notice.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "5. Return of Materials" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Upon request, each Party shall promptly return or destroy all Confidential Information received from the other Party and certify in writing that it has done so.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "6. Governing Law" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Agreement shall be governed by the laws of " },
            { type: "templateVariable", attrs: { variable: "governing_law" } },
            { type: "text", text: ", without regard to conflict of law principles." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "7. Entire Agreement" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This Agreement constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior discussions and agreements.",
            },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.",
              marks: [{ type: "bold" }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Party A: " },
            { type: "templateVariable", attrs: { variable: "party_a_name" } },
            { type: "text", text: "    Signature: _______________    Date: _______________" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Party B: " },
            { type: "templateVariable", attrs: { variable: "party_b_name" } },
            { type: "text", text: "    Signature: _______________    Date: _______________" },
          ],
        },
      ],
    },
  },

  // ─── 2. One-Way NDA ───────────────────────────────────────────────────────
  {
    name: "One-Way Non-Disclosure Agreement",
    description:
      "One-directional NDA where only one party shares confidential information. Ideal for sharing business plans, pricing, or proprietary processes with a vendor or potential partner.",
    contractType: "NDA",
    variables: [
      { name: "disclosing_party", label: "Disclosing Party (Your Company)", type: "text", required: true },
      { name: "receiving_party", label: "Receiving Party", type: "text", required: true },
      { name: "effective_date", label: "Effective Date", type: "date", required: true },
      {
        name: "purpose",
        label: "Purpose of Disclosure",
        type: "text",
        required: true,
        defaultValue: "evaluating a potential business relationship",
      },
      { name: "term_years", label: "Term (years)", type: "number", required: true, defaultValue: "2" },
      { name: "governing_law", label: "Governing Law", type: "text", required: true, defaultValue: "California" },
    ],
    wordCount: 249,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "NON-DISCLOSURE AGREEMENT" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Non-Disclosure Agreement (“Agreement”) is entered into as of " },
            { type: "templateVariable", attrs: { variable: "effective_date" } },
            { type: "text", text: ", between " },
            { type: "templateVariable", attrs: { variable: "disclosing_party" } },
            { type: "text", text: " (“Disclosing Party”) and " },
            { type: "templateVariable", attrs: { variable: "receiving_party" } },
            { type: "text", text: " (“Receiving Party”)." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "1. Purpose" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "The Receiving Party desires to receive certain confidential information from the Disclosing Party for the purpose of ",
            },
            { type: "templateVariable", attrs: { variable: "purpose" } },
            { type: "text", text: "." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "2. Confidential Information" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "“Confidential Information” means any non-public, proprietary information disclosed by the Disclosing Party to the Receiving Party, including but not limited to business plans, financial information, technical data, trade secrets, and customer lists.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "3. Obligations of Receiving Party" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "The Receiving Party agrees to: (a) maintain the Confidential Information in strict confidence; (b) not disclose the Confidential Information to any third party; (c) use the Confidential Information only for the Purpose stated above; (d) protect the Confidential Information with at least the same degree of care used to protect its own confidential information.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "4. Term" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Agreement shall be in effect for " },
            { type: "templateVariable", attrs: { variable: "term_years" } },
            { type: "text", text: " year(s) from the Effective Date." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "5. Governing Law" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Agreement is governed by the laws of " },
            { type: "templateVariable", attrs: { variable: "governing_law" } },
            { type: "text", text: "." },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Disclosing Party: " },
            { type: "templateVariable", attrs: { variable: "disclosing_party" } },
            { type: "text", text: "    Signature: _______________" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Receiving Party: " },
            { type: "templateVariable", attrs: { variable: "receiving_party" } },
            { type: "text", text: "    Signature: _______________" },
          ],
        },
      ],
    },
  },

  // ─── 3. Master Service Agreement ──────────────────────────────────────────
  {
    name: "Master Service Agreement",
    description:
      "Framework agreement governing the ongoing relationship between a service provider and client. Covers payment terms, IP ownership, liability, and termination.",
    contractType: "MSA",
    variables: [
      { name: "client_name", label: "Client Name", type: "text", required: true },
      { name: "provider_name", label: "Service Provider Name", type: "text", required: true },
      { name: "effective_date", label: "Effective Date", type: "date", required: true },
      { name: "payment_terms_days", label: "Payment Terms (days)", type: "number", required: true, defaultValue: "30" },
      {
        name: "liability_cap_months",
        label: "Liability Cap (months of fees)",
        type: "number",
        required: true,
        defaultValue: "12",
      },
      { name: "governing_law", label: "Governing Law", type: "text", required: true, defaultValue: "California" },
    ],
    wordCount: 313,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "MASTER SERVICE AGREEMENT" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Master Service Agreement (“Agreement”) is entered into as of " },
            { type: "templateVariable", attrs: { variable: "effective_date" } },
            { type: "text", text: ", between " },
            { type: "templateVariable", attrs: { variable: "client_name" } },
            { type: "text", text: " (“Client”) and " },
            { type: "templateVariable", attrs: { variable: "provider_name" } },
            { type: "text", text: " (“Provider”)." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "1. Services" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Provider agrees to perform the services described in one or more Statements of Work (“SOW”) executed under this Agreement. Each SOW is incorporated herein by reference.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "2. Payment" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Client shall pay all invoices within " },
            { type: "templateVariable", attrs: { variable: "payment_terms_days" } },
            {
              type: "text",
              text: " days of receipt. Late payments shall accrue interest at 1.5% per month. Provider may suspend services for payments overdue by more than 30 days.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "3. Intellectual Property" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "All work product created by Provider specifically for Client under an SOW shall be owned by Client upon full payment. Provider retains ownership of its pre-existing intellectual property and general methodologies.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "4. Confidentiality" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Each Party agrees to maintain the other Party’s confidential information in strict confidence and not disclose it to third parties without prior written consent. This obligation survives termination for 3 years.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "5. Limitation of Liability" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. PROVIDER’S TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY CLIENT IN THE ",
            },
            { type: "templateVariable", attrs: { variable: "liability_cap_months" } },
            { type: "text", text: " MONTHS PRECEDING THE CLAIM." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "6. Term and Termination" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This Agreement continues until terminated. Either Party may terminate with 30 days written notice. Client may terminate immediately for Provider’s material breach uncured within 15 days of notice.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "7. Governing Law" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Agreement is governed by the laws of " },
            { type: "templateVariable", attrs: { variable: "governing_law" } },
            { type: "text", text: "." },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Client: " },
            { type: "templateVariable", attrs: { variable: "client_name" } },
            { type: "text", text: "    Signature: _______________    Date: _______________" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Provider: " },
            { type: "templateVariable", attrs: { variable: "provider_name" } },
            { type: "text", text: "    Signature: _______________    Date: _______________" },
          ],
        },
      ],
    },
  },

  // ─── 4. Statement of Work ─────────────────────────────────────────────────
  {
    name: "Statement of Work",
    description:
      "Project-specific work order used alongside a Master Service Agreement. Defines scope, deliverables, timeline, and fees for a specific engagement.",
    contractType: "SOW",
    variables: [
      { name: "client_name", label: "Client Name", type: "text", required: true },
      { name: "provider_name", label: "Provider Name", type: "text", required: true },
      { name: "project_name", label: "Project Name", type: "text", required: true },
      { name: "start_date", label: "Start Date", type: "date", required: true },
      { name: "end_date", label: "End Date", type: "date", required: true },
      { name: "total_fee", label: "Total Project Fee ($)", type: "number", required: true },
      {
        name: "deliverables",
        label: "Key Deliverables",
        type: "text",
        required: true,
        defaultValue: "As described in the project scope below",
      },
      { name: "effective_date", label: "SOW Date", type: "date", required: true },
    ],
    wordCount: 237,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "STATEMENT OF WORK" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Statement of Work (“SOW”) is entered into as of " },
            { type: "templateVariable", attrs: { variable: "effective_date" } },
            { type: "text", text: " between " },
            { type: "templateVariable", attrs: { variable: "client_name" } },
            { type: "text", text: " (“Client”) and " },
            { type: "templateVariable", attrs: { variable: "provider_name" } },
            {
              type: "text",
              text: " (“Provider”), and is governed by the Master Service Agreement between the Parties.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "1. Project Overview" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Project Name: " },
            { type: "templateVariable", attrs: { variable: "project_name" } },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Project Period: " },
            { type: "templateVariable", attrs: { variable: "start_date" } },
            { type: "text", text: " through " },
            { type: "templateVariable", attrs: { variable: "end_date" } },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "2. Scope of Work" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Provider shall perform the following services: [describe the specific work, methodology, and approach here]",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "3. Deliverables" }],
        },
        {
          type: "paragraph",
          content: [{ type: "templateVariable", attrs: { variable: "deliverables" } }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "4. Acceptance Criteria" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Client shall review each deliverable within 10 business days of receipt and either accept it in writing or provide detailed written feedback. Deliverables not rejected within 10 business days are deemed accepted.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "5. Fees and Payment" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Total Project Fee: $" },
            { type: "templateVariable", attrs: { variable: "total_fee" } },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Payment schedule: 50% upon SOW execution, 50% upon final deliverable acceptance.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "6. Change Orders" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Any changes to the scope of work require a written change order signed by both Parties. Provider is not obligated to perform out-of-scope work without an executed change order.",
            },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Client: " },
            { type: "templateVariable", attrs: { variable: "client_name" } },
            { type: "text", text: "    Signature: _______________    Date: _______________" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Provider: " },
            { type: "templateVariable", attrs: { variable: "provider_name" } },
            { type: "text", text: "    Signature: _______________    Date: _______________" },
          ],
        },
      ],
    },
  },

  // ─── 5. Independent Contractor Agreement ──────────────────────────────────
  {
    name: "Independent Contractor Agreement",
    description:
      "Agreement for hiring freelancers and independent contractors. Covers scope of work, payment, IP ownership, and classification.",
    contractType: "VENDOR",
    variables: [
      { name: "company_name", label: "Company Name", type: "text", required: true },
      { name: "contractor_name", label: "Contractor Full Name", type: "text", required: true },
      { name: "effective_date", label: "Start Date", type: "date", required: true },
      { name: "project_description", label: "Project / Services Description", type: "text", required: true },
      { name: "rate", label: "Rate (e.g. $150/hour or $5,000 fixed)", type: "text", required: true },
      {
        name: "payment_terms_days",
        label: "Payment Terms (days)",
        type: "number",
        required: true,
        defaultValue: "14",
      },
      { name: "governing_law", label: "Governing Law", type: "text", required: true, defaultValue: "California" },
    ],
    wordCount: 324,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "INDEPENDENT CONTRACTOR AGREEMENT" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This Independent Contractor Agreement (“Agreement”) is entered into as of ",
            },
            { type: "templateVariable", attrs: { variable: "effective_date" } },
            { type: "text", text: ", between " },
            { type: "templateVariable", attrs: { variable: "company_name" } },
            { type: "text", text: " (“Company”) and " },
            { type: "templateVariable", attrs: { variable: "contractor_name" } },
            { type: "text", text: " (“Contractor”)." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "1. Services" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Contractor agrees to provide the following services: " },
            { type: "templateVariable", attrs: { variable: "project_description" } },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "2. Independent Contractor Status" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Contractor is an independent contractor, not an employee of Company. Contractor is responsible for all taxes on compensation received under this Agreement. Contractor is not entitled to employee benefits.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "3. Compensation" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Company shall pay Contractor at the rate of " },
            { type: "templateVariable", attrs: { variable: "rate" } },
            { type: "text", text: ". Invoices are due within " },
            { type: "templateVariable", attrs: { variable: "payment_terms_days" } },
            { type: "text", text: " days of receipt." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "4. Intellectual Property" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "All work product, inventions, and deliverables created by Contractor in connection with the Services shall be considered works made for hire and shall be the sole property of Company. To the extent such work does not qualify as work made for hire, Contractor assigns all rights to Company.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "5. Confidentiality" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Contractor agrees to keep all Company information confidential and not disclose it to third parties during or after the term of this Agreement.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "6. Non-Solicitation" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "During the term and for 12 months thereafter, Contractor shall not solicit Company’s employees, customers, or clients.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "7. Termination" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Either Party may terminate this Agreement with 14 days written notice. Company may terminate immediately for Contractor’s material breach.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "8. Governing Law" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Agreement is governed by the laws of " },
            { type: "templateVariable", attrs: { variable: "governing_law" } },
            { type: "text", text: "." },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Company: " },
            { type: "templateVariable", attrs: { variable: "company_name" } },
            { type: "text", text: "    Signature: _______________    Date: _______________" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Contractor: " },
            { type: "templateVariable", attrs: { variable: "contractor_name" } },
            { type: "text", text: "    Signature: _______________" },
          ],
        },
      ],
    },
  },

  // ─── 6. Vendor Agreement ──────────────────────────────────────────────────
  {
    name: "Vendor Agreement",
    description:
      "Agreement for purchasing goods or services from a vendor. Covers pricing, delivery, warranties, and termination rights.",
    contractType: "VENDOR",
    variables: [
      { name: "buyer_name", label: "Buyer (Your Company)", type: "text", required: true },
      { name: "vendor_name", label: "Vendor Name", type: "text", required: true },
      { name: "effective_date", label: "Effective Date", type: "date", required: true },
      { name: "product_service", label: "Products/Services Being Purchased", type: "text", required: true },
      { name: "contract_value", label: "Estimated Annual Value ($)", type: "number", required: false },
      {
        name: "payment_terms_days",
        label: "Payment Terms (days)",
        type: "number",
        required: true,
        defaultValue: "30",
      },
      { name: "governing_law", label: "Governing Law", type: "text", required: true, defaultValue: "California" },
    ],
    wordCount: 287,
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "VENDOR AGREEMENT" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Vendor Agreement (“Agreement”) is entered into as of " },
            { type: "templateVariable", attrs: { variable: "effective_date" } },
            { type: "text", text: ", between " },
            { type: "templateVariable", attrs: { variable: "buyer_name" } },
            { type: "text", text: " (“Buyer”) and " },
            { type: "templateVariable", attrs: { variable: "vendor_name" } },
            { type: "text", text: " (“Vendor”)." },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "1. Products and Services" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Vendor agrees to provide: " },
            { type: "templateVariable", attrs: { variable: "product_service" } },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "2. Pricing and Payment" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Buyer shall pay all invoices within " },
            { type: "templateVariable", attrs: { variable: "payment_terms_days" } },
            {
              type: "text",
              text: " days of receipt. Vendor must provide itemized invoices. Prices are fixed for the initial term unless agreed in writing.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "3. Delivery and Performance" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Vendor shall deliver products/services on time and meeting the specifications agreed upon. Time is of the essence. Vendor shall promptly notify Buyer of any anticipated delays.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "4. Warranties" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Vendor warrants that all products/services: (a) conform to agreed specifications; (b) are free from defects in materials and workmanship; (c) do not infringe any third-party intellectual property rights.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "5. Liability" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Vendor’s liability for any claim under this Agreement shall not exceed the amounts paid by Buyer in the 12 months preceding the claim. Neither party shall be liable for indirect or consequential damages.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "6. Term and Termination" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Agreement is effective from " },
            { type: "templateVariable", attrs: { variable: "effective_date" } },
            {
              type: "text",
              text: " and continues for one year, automatically renewing annually unless either Party provides 60 days’ written notice of non-renewal. Either Party may terminate for cause with 30 days’ written notice.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "7. Governing Law" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This Agreement is governed by the laws of " },
            { type: "templateVariable", attrs: { variable: "governing_law" } },
            { type: "text", text: "." },
          ],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Buyer: " },
            { type: "templateVariable", attrs: { variable: "buyer_name" } },
            { type: "text", text: "    Signature: _______________    Date: _______________" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Vendor: " },
            { type: "templateVariable", attrs: { variable: "vendor_name" } },
            { type: "text", text: "    Signature: _______________    Date: _______________" },
          ],
        },
      ],
    },
  },
]

// ---------------------------------------------------------------------------
// POST /api/templates/seed
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  if (!hasRole(ctx.role, "admin")) {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  return requestContext.run(ctx, async () => {
    // Find which starter names already exist for this org (idempotency check)
    const starterNames = STARTER_TEMPLATES.map((t) => t.name)
    const existing = await prisma.contractTemplate.findMany({
      where: {
        organizationId: ctx.organizationId,
        name: { in: starterNames },
        isArchived: false,
      },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((e) => e.name))

    const toCreate = STARTER_TEMPLATES.filter((t) => !existingNames.has(t.name))

    if (toCreate.length > 0) {
      const rows: Prisma.ContractTemplateUncheckedCreateInput[] = toCreate.map((t) => ({
        name: t.name,
        description: t.description,
        contractType: t.contractType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: t.content as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variables: t.variables as any,
        wordCount: t.wordCount,
        createdById: ctx.userId,
        updatedById: ctx.userId,
        organizationId: ctx.organizationId,
      }))

      await prisma.contractTemplate.createMany({ data: rows })
    }

    return Response.json(
      {
        created: toCreate.length,
        skipped: existingNames.size,
      },
      { status: 200 },
    )
  })
}

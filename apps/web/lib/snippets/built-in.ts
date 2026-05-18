export interface BuiltInSnippet {
  id: string          // prefixed with "builtin_"
  name: string
  category: string
  contentText: string // plain text version for search
  content: object[]   // TipTap JSON array of block nodes (inner content array, not a full doc)
}

export const BUILT_IN_SNIPPETS: BuiltInSnippet[] = [
  // ─── Liability ────────────────────────────────────────────────────────────

  {
    id: "builtin_lol_balanced",
    name: "Limitation of Liability (balanced)",
    category: "Liability",
    contentText:
      "IN NO EVENT SHALL EITHER PARTY BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. EACH PARTY'S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT SHALL NOT EXCEED THE AMOUNTS PAID OR PAYABLE BY CUSTOMER UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Limitation of Liability" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "IN NO EVENT SHALL EITHER PARTY BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "EACH PARTY'S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT SHALL NOT EXCEED THE AMOUNTS PAID OR PAYABLE BY CUSTOMER UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.",
          },
        ],
      },
    ],
  },

  {
    id: "builtin_lol_pro_vendor",
    name: "Limitation of Liability (pro-vendor)",
    category: "Liability",
    contentText:
      "IN NO EVENT SHALL VENDOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES. VENDOR'S TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID IN THE THREE (3) MONTHS PRECEDING THE CLAIM.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Limitation of Liability" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "IN NO EVENT SHALL VENDOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES.",
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "VENDOR'S TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID IN THE THREE (3) MONTHS PRECEDING THE CLAIM.",
          },
        ],
      },
    ],
  },

  // ─── General ─────────────────────────────────────────────────────────────

  {
    id: "builtin_force_majeure",
    name: "Force Majeure",
    category: "General",
    contentText:
      'Neither party shall be liable for any failure or delay in performance under this Agreement to the extent such failure or delay is caused by circumstances beyond such party\'s reasonable control, including but not limited to acts of God, natural disasters, pandemic, war, terrorism, labor disputes, or governmental action (each, a "Force Majeure Event"). The affected party shall provide prompt written notice to the other party and use commercially reasonable efforts to resume performance as soon as practicable.',
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Force Majeure" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: 'Neither party shall be liable for any failure or delay in performance under this Agreement to the extent such failure or delay is caused by circumstances beyond such party\'s reasonable control, including but not limited to acts of God, natural disasters, pandemic, war, terrorism, labor disputes, or governmental action (each, a "Force Majeure Event"). The affected party shall provide prompt written notice to the other party and use commercially reasonable efforts to resume performance as soon as practicable.',
          },
        ],
      },
    ],
  },

  {
    id: "builtin_entire_agreement",
    name: "Entire Agreement",
    category: "General",
    contentText:
      "This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, representations, warranties, and understandings of the parties with respect to such subject matter.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Entire Agreement" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, representations, warranties, and understandings of the parties with respect to such subject matter.",
          },
        ],
      },
    ],
  },

  {
    id: "builtin_severability",
    name: "Severability",
    category: "General",
    contentText:
      "If any provision of this Agreement is held to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid, illegal, or unenforceable provision shall be modified to the minimum extent necessary to make it valid, legal, and enforceable.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Severability" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "If any provision of this Agreement is held to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid, illegal, or unenforceable provision shall be modified to the minimum extent necessary to make it valid, legal, and enforceable.",
          },
        ],
      },
    ],
  },

  {
    id: "builtin_counterparts_esig",
    name: "Counterparts / E-Signature",
    category: "General",
    contentText:
      "This Agreement may be executed in counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument. Electronic signatures shall be deemed valid and binding to the same extent as original signatures.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Counterparts and Electronic Signature" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "This Agreement may be executed in counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument. Electronic signatures shall be deemed valid and binding to the same extent as original signatures.",
          },
        ],
      },
    ],
  },

  {
    id: "builtin_waiver",
    name: "Waiver",
    category: "General",
    contentText:
      "No waiver of any provision of this Agreement shall be effective unless made in writing and signed by the waiving party. The failure of either party to enforce any provision of this Agreement shall not constitute a waiver of that party's right to enforce such provision in the future.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Waiver" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "No waiver of any provision of this Agreement shall be effective unless made in writing and signed by the waiving party. The failure of either party to enforce any provision of this Agreement shall not constitute a waiver of that party's right to enforce such provision in the future.",
          },
        ],
      },
    ],
  },

  // ─── Governing Law ────────────────────────────────────────────────────────

  {
    id: "builtin_gov_law_delaware",
    name: "Governing Law (Delaware)",
    category: "Governing Law",
    contentText:
      "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws provisions. Any disputes arising under this Agreement shall be resolved in the state or federal courts located in Delaware, and each party hereby consents to the exclusive jurisdiction of such courts.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Governing Law" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws provisions. Any disputes arising under this Agreement shall be resolved in the state or federal courts located in Delaware, and each party hereby consents to the exclusive jurisdiction of such courts.",
          },
        ],
      },
    ],
  },

  {
    id: "builtin_gov_law_california",
    name: "Governing Law (California)",
    category: "Governing Law",
    contentText:
      "This Agreement shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of laws provisions. Any disputes shall be resolved in the courts of San Francisco County, California.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Governing Law" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "This Agreement shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of laws provisions. Any disputes shall be resolved in the courts of San Francisco County, California.",
          },
        ],
      },
    ],
  },

  {
    id: "builtin_gov_law_new_york",
    name: "Governing Law (New York)",
    category: "Governing Law",
    contentText:
      "This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of laws principles.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Governing Law" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of laws principles.",
          },
        ],
      },
    ],
  },

  // ─── Confidentiality ─────────────────────────────────────────────────────

  {
    id: "builtin_confidentiality_obligation",
    name: "Confidentiality Obligation",
    category: "Confidentiality",
    contentText:
      "Each party agrees to hold the other party's Confidential Information in strict confidence and to not disclose such information to any third party without the prior written consent of the disclosing party. Each party agrees to use the Confidential Information solely for the purpose of performing its obligations under this Agreement and to protect such information using at least the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Confidentiality" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Each party agrees to hold the other party's Confidential Information in strict confidence and to not disclose such information to any third party without the prior written consent of the disclosing party. Each party agrees to use the Confidential Information solely for the purpose of performing its obligations under this Agreement and to protect such information using at least the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.",
          },
        ],
      },
    ],
  },

  {
    id: "builtin_return_of_materials",
    name: "Return of Materials",
    category: "Confidentiality",
    contentText:
      "Upon termination or expiration of this Agreement, or upon the written request of the disclosing party, the receiving party shall promptly return or destroy all Confidential Information of the disclosing party in its possession, and shall certify in writing to the disclosing party that it has done so.",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Return of Materials" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Upon termination or expiration of this Agreement, or upon the written request of the disclosing party, the receiving party shall promptly return or destroy all Confidential Information of the disclosing party in its possession, and shall certify in writing to the disclosing party that it has done so.",
          },
        ],
      },
    ],
  },

  // ─── IP ───────────────────────────────────────────────────────────────────

  {
    id: "builtin_ip_work_for_hire",
    name: "IP Ownership (Work for Hire)",
    category: "IP",
    contentText:
      'All work product, deliverables, inventions, developments, improvements, and other intellectual property created by [Service Provider] in connection with the Services ("Work Product") shall be considered works made for hire and shall be the sole and exclusive property of [Client]. To the extent any Work Product does not qualify as a work made for hire under applicable law, [Service Provider] hereby irrevocably assigns all right, title, and interest in and to such Work Product to [Client].',
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Intellectual Property Ownership" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: 'All work product, deliverables, inventions, developments, improvements, and other intellectual property created by [Service Provider] in connection with the Services ("Work Product") shall be considered works made for hire and shall be the sole and exclusive property of [Client]. To the extent any Work Product does not qualify as a work made for hire under applicable law, [Service Provider] hereby irrevocably assigns all right, title, and interest in and to such Work Product to [Client].',
          },
        ],
      },
    ],
  },
]

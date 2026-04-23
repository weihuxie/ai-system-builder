// ───────────────────────────────────────────
// Seed data: default product catalog + quick scenarios
// Used by:
//   - supabase/seed.sql (generated / copied from here)
//   - client "Reset to defaults" button
//   - tests / golden sets
// ───────────────────────────────────────────

import type { LlmChain, ProductItem, QuickOption, Lang } from './types.js';

// Default LLM fallback chain. Order matters — runtime tries top → bottom.
// Kimi is listed after Gemini Flash because the primary brand's ecosystem is Google;
// lecturers can reorder live in /admin without redeploy.
export const DEFAULT_LLM_CHAIN: LlmChain = [
  { providerId: 'gemini', model: 'gemini-2.5-flash', enabled: true },
  { providerId: 'kimi', model: 'moonshot-v1-32k', enabled: true },
  { providerId: 'deepseek', model: 'deepseek-chat', enabled: true },
  { providerId: 'gemini', model: 'gemini-2.5-flash-lite', enabled: true },
];

export const DEFAULT_TEMPERATURE = 0.7;

const now = new Date().toISOString();

export const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: 'CRM',
    name: {
      'zh-CN': '客户关系管理 (CRM)',
      'zh-HK': '客戶關係管理 (CRM)',
      en: 'Customer Relationship Management (CRM)',
      ja: '顧客関係管理 (CRM)',
    },
    description: {
      'zh-CN': '整合客户数据、追踪销售漏斗、自动化客服工单。解决销售团队协作效率低、客户资料散落多处、转化率难以提升的痛点。',
      'zh-HK': '整合客戶資料、追蹤銷售漏斗、自動化客服工單。解決銷售團隊協作效率低、客戶資料散落多處、轉化率難以提升的痛點。',
      en: 'Centralize customer data, track sales pipelines, and automate support tickets. Addresses low sales collaboration, scattered customer records, and stalled conversion.',
      ja: '顧客データの統合、セールスパイプラインの追跡、サポートチケットの自動化。営業連携の非効率、顧客情報の散在、低コンバージョンに対応。',
    },
    audience: {
      'zh-CN': '销售VP、客户成功经理、市场运营',
      'zh-HK': '銷售VP、客戶成功經理、市場運營',
      en: 'VP of Sales, Customer Success Manager, Marketing Ops',
      ja: '営業VP、カスタマーサクセスマネージャー、マーケティング運営',
    },
    url: {
      google: {
        'zh-CN': 'https://workspace.google.com/intl/zh-CN/',
        'zh-HK': 'https://workspace.google.com/intl/zh-HK/',
        en: 'https://workspace.google.com/',
        ja: 'https://workspace.google.com/intl/ja/',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/connect/',
        'zh-HK': 'https://aws.amazon.com/connect/',
        en: 'https://aws.amazon.com/connect/',
        ja: 'https://aws.amazon.com/jp/connect/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
  },
  {
    id: 'CLM',
    name: {
      'zh-CN': '合同全生命周期管理 (CLM)',
      'zh-HK': '合同全生命週期管理 (CLM)',
      en: 'Contract Lifecycle Management (CLM)',
      ja: '契約ライフサイクル管理 (CLM)',
    },
    description: {
      'zh-CN': '覆盖合同从起草、审批、签署、履约到续约的完整生命周期，集成电子签和风险扫描。降低法务风险、加速合同流转、提升合规可追溯性。',
      'zh-HK': '覆蓋合同從起草、審批、簽署、履約到續約的完整生命週期，整合電子簽和風險掃描。降低法務風險、加速合同流轉、提升合規可追溯性。',
      en: 'End-to-end contract lifecycle — drafting, approval, e-signing, performance, and renewal — with risk scanning and audit trails. Cuts legal risk and cycle time.',
      ja: '契約のドラフト作成から承認、電子署名、履行、更新までのフルライフサイクル管理。リスクスキャンと監査証跡で法務リスクと回転時間を削減。',
    },
    audience: {
      'zh-CN': '法务总监、销售VP、采购负责人',
      'zh-HK': '法務總監、銷售VP、採購負責人',
      en: 'General Counsel, VP of Sales, Head of Procurement',
      ja: '法務責任者、営業VP、調達責任者',
    },
    url: {
      google: {
        'zh-CN': 'https://workspace.google.com/intl/zh-CN/',
        'zh-HK': 'https://workspace.google.com/intl/zh-HK/',
        en: 'https://workspace.google.com/',
        ja: 'https://workspace.google.com/intl/ja/',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/marketplace/',
        'zh-HK': 'https://aws.amazon.com/marketplace/',
        en: 'https://aws.amazon.com/marketplace/',
        ja: 'https://aws.amazon.com/jp/marketplace/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
  },
  {
    id: 'ERP',
    name: {
      'zh-CN': '跨境电商 ERP',
      'zh-HK': '跨境電商 ERP',
      en: 'Cross-border E-commerce ERP',
      ja: '越境EC向けERP',
    },
    description: {
      'zh-CN': '打通多店铺订单、多仓库库存、跨国物流、清关、退税与财务对账。解决东南亚、中东、欧美多站点订单爆仓、断货、清关慢、账实不符的痛点。',
      'zh-HK': '打通多店舖訂單、多倉庫庫存、跨國物流、清關、退稅與財務對賬。解決東南亞、中東、歐美多站點訂單爆倉、斷貨、清關慢、賬實不符的痛點。',
      en: 'Unified orders, inventory, cross-border logistics, customs, VAT, and reconciliation across marketplaces. Eliminates stockouts, slow customs, and reconciliation gaps.',
      ja: '多店舗注文・多拠点在庫・越境物流・通関・VAT/消費税・財務照合を統合。東南アジア/中東/欧米で在庫切れや通関遅延、照合不一致を解消。',
    },
    audience: {
      'zh-CN': '跨境电商COO、供应链总监、财务总监',
      'zh-HK': '跨境電商COO、供應鏈總監、財務總監',
      en: 'Cross-border COO, Supply Chain Director, CFO',
      ja: '越境EC COO、サプライチェーン責任者、CFO',
    },
    url: {
      google: {
        'zh-CN': 'https://cloud.google.com/solutions/retail?hl=zh-CN',
        'zh-HK': 'https://cloud.google.com/solutions/retail?hl=zh-TW',
        en: 'https://cloud.google.com/solutions/retail',
        ja: 'https://cloud.google.com/solutions/retail?hl=ja',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/retail/',
        'zh-HK': 'https://aws.amazon.com/retail/',
        en: 'https://aws.amazon.com/retail/',
        ja: 'https://aws.amazon.com/jp/retail/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
  },
  {
    id: 'Translation',
    name: {
      'zh-CN': '商务翻译系统',
      'zh-HK': '商務翻譯系統',
      en: 'Business Translation Platform',
      ja: 'ビジネス翻訳プラットフォーム',
    },
    description: {
      'zh-CN': '针对合同、招投标、营销素材、客服工单的 AI 翻译与术语库管理。支持行业词表定制、人工审校流转、格式保留（PDF/Docx/SRT）。',
      'zh-HK': '針對合同、招投標、營銷素材、客服工單的 AI 翻譯與術語庫管理。支持行業詞表定制、人工審校流轉、格式保留（PDF/Docx/SRT）。',
      en: 'AI translation with industry glossaries for contracts, RFPs, marketing content, and support tickets. Keeps formatting (PDF/Docx/SRT) and routes to human review.',
      ja: '契約書・入札文書・マーケ素材・サポート案件向けのAI翻訳と用語集管理。業界用語のカスタマイズ、人手レビュー、フォーマット保持（PDF/Docx/SRT）に対応。',
    },
    audience: {
      'zh-CN': '海外事业部总监、市场VP、客户支持负责人',
      'zh-HK': '海外事業部總監、市場VP、客戶支援負責人',
      en: 'VP International, CMO, Head of Customer Support',
      ja: '海外事業責任者、CMO、カスタマーサポート責任者',
    },
    url: {
      google: {
        'zh-CN': 'https://cloud.google.com/translate?hl=zh-CN',
        'zh-HK': 'https://cloud.google.com/translate?hl=zh-TW',
        en: 'https://cloud.google.com/translate',
        ja: 'https://cloud.google.com/translate?hl=ja',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/translate/',
        'zh-HK': 'https://aws.amazon.com/translate/',
        en: 'https://aws.amazon.com/translate/',
        ja: 'https://aws.amazon.com/jp/translate/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
  },
  {
    id: 'IDCompliance',
    name: {
      'zh-CN': '印尼合规性审查',
      'zh-HK': '印尼合規性審查',
      en: 'Indonesia Compliance Review',
      ja: 'インドネシア法令遵守レビュー',
    },
    description: {
      'zh-CN': '覆盖印尼 UU PDP（个人数据保护法）、OJK 金融监管、BPOM 产品合规、清真认证。自动扫描数据流、供应链与合同条款，生成整改清单与 DPIA 报告。',
      'zh-HK': '覆蓋印尼 UU PDP（個人資料保護法）、OJK 金融監管、BPOM 產品合規、清真認證。自動掃描資料流、供應鏈與合同條款，生成整改清單與 DPIA 報告。',
      en: "Covers Indonesia's UU PDP data law, OJK financial rules, BPOM product standards, and halal certification. Scans data flows, supply chain, and contracts; outputs gap list and DPIA.",
      ja: 'インドネシアのUU PDP（個人情報保護法）、OJK金融規制、BPOM製品認証、ハラール認証に対応。データフロー、サプライチェーン、契約条項を自動スキャンし是正リストとDPIAを生成。',
    },
    audience: {
      'zh-CN': '东南亚法务总监、DPO、合规经理',
      'zh-HK': '東南亞法務總監、DPO、合規經理',
      en: 'SEA Legal Head, DPO, Compliance Manager',
      ja: '東南アジア法務責任者、DPO、コンプライアンスマネージャー',
    },
    url: {
      google: {
        'zh-CN': 'https://cloud.google.com/security/compliance?hl=zh-CN',
        'zh-HK': 'https://cloud.google.com/security/compliance?hl=zh-TW',
        en: 'https://cloud.google.com/security/compliance',
        ja: 'https://cloud.google.com/security/compliance?hl=ja',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/compliance/',
        'zh-HK': 'https://aws.amazon.com/compliance/',
        en: 'https://aws.amazon.com/compliance/',
        ja: 'https://aws.amazon.com/jp/compliance/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
  },
  {
    id: 'GDPR',
    name: {
      'zh-CN': 'GDPR 合规性审查',
      'zh-HK': 'GDPR 合規性審查',
      en: 'GDPR Compliance Review',
      ja: 'GDPRコンプライアンスレビュー',
    },
    description: {
      'zh-CN': '对标欧盟 GDPR，扫描跨境数据流、同意机制、第三方共享与 DPIA。生成数据地图和跨境传输风险报告，支撑 CNIL / ICO 查询应答。',
      'zh-HK': '對標歐盟 GDPR，掃描跨境資料流、同意機制、第三方共享與 DPIA。生成資料地圖和跨境傳輸風險報告，支撐 CNIL / ICO 查詢應答。',
      en: 'Audits data flows, consent, third-party sharing, and DPIAs against EU GDPR. Generates data maps and cross-border transfer risk reports for CNIL / ICO inquiries.',
      ja: 'EU GDPRに対応し、越境データフロー、同意取得、第三者共有、DPIAを監査。データマップと越境移転リスクレポートを生成、CNIL/ICO照会に備えます。',
    },
    audience: {
      'zh-CN': '法务总监、DPO、CISO',
      'zh-HK': '法務總監、DPO、CISO',
      en: 'General Counsel, DPO, CISO',
      ja: '法務責任者、DPO、CISO',
    },
    url: {
      google: {
        'zh-CN': 'https://cloud.google.com/privacy/gdpr?hl=zh-CN',
        'zh-HK': 'https://cloud.google.com/privacy/gdpr?hl=zh-TW',
        en: 'https://cloud.google.com/privacy/gdpr',
        ja: 'https://cloud.google.com/privacy/gdpr?hl=ja',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/compliance/gdpr-center/',
        'zh-HK': 'https://aws.amazon.com/compliance/gdpr-center/',
        en: 'https://aws.amazon.com/compliance/gdpr-center/',
        ja: 'https://aws.amazon.com/jp/compliance/gdpr-center/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
  },
  {
    id: 'AgentBuilder',
    name: {
      'zh-CN': '企业级 Agent 搭建系统',
      'zh-HK': '企業級 Agent 搭建系統',
      en: 'Enterprise Agent Platform',
      ja: 'エンタープライズAIエージェント構築プラットフォーム',
    },
    description: {
      'zh-CN': '低代码搭建自动化 AI Agent，连接企业数据（ERP/CRM/工单）和工具（邮件、审批、代码仓库），内置权限、审计与成本控制。',
      'zh-HK': '低代碼搭建自動化 AI Agent，連接企業資料（ERP/CRM/工單）和工具（郵件、審批、代碼倉庫），內置權限、審計與成本控制。',
      en: 'Low-code platform to build AI agents that orchestrate enterprise data (ERP/CRM/tickets) and tools (email, approvals, repos) with built-in RBAC, audit, and cost guardrails.',
      ja: 'エンタープライズデータ（ERP/CRM/チケット）とツール（メール、承認、リポジトリ）を連携するAIエージェントをローコードで構築。RBAC、監査、コスト制御を内蔵。',
    },
    audience: {
      'zh-CN': 'CTO、AI负责人、自动化业务负责人',
      'zh-HK': 'CTO、AI負責人、自動化業務負責人',
      en: 'CTO, Head of AI, Head of Automation',
      ja: 'CTO、AI責任者、自動化責任者',
    },
    url: {
      google: {
        'zh-CN': 'https://cloud.google.com/products/agent-builder?hl=zh-CN',
        'zh-HK': 'https://cloud.google.com/products/agent-builder?hl=zh-TW',
        en: 'https://cloud.google.com/products/agent-builder',
        ja: 'https://cloud.google.com/products/agent-builder?hl=ja',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/bedrock/agents/',
        'zh-HK': 'https://aws.amazon.com/bedrock/agents/',
        en: 'https://aws.amazon.com/bedrock/agents/',
        ja: 'https://aws.amazon.com/jp/bedrock/agents/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
  },
];

/**
 * Quick scenarios shown on the landing page.
 * 4 fixed cards per language; click → auto-compose "我是<industry>的<role>，痛点是<challenge>".
 */
export const DEFAULT_QUICK_OPTIONS: Record<Lang, QuickOption[]> = {
  'zh-CN': [
    { role: '财务总监', industry: '跨国制造企业', challenge: '跨国团队差旅报销混乱，财务对账困难，缺乏费用透明度。' },
    { role: '销售VP', industry: '科技公司', challenge: '销售与法务协作效率低，合同审批慢，客户数据经常丢失。' },
    { role: 'CMO', industry: '零售品牌', challenge: '客户数据分散在各个系统，营销转化率低，缺乏深度数据洞察。' },
    { role: '研发负责人', industry: '互联网公司', challenge: '研发与业务脱节，项目进度难以把控，资源分配不合理。' },
  ],
  'zh-HK': [
    { role: '財務總監', industry: '跨國製造企業', challenge: '跨國團隊差旅報銷混亂，財務對賬困難，缺乏費用透明度。' },
    { role: '銷售VP', industry: '科技公司', challenge: '銷售與法務協作效率低，合同審批慢，客戶資料經常丟失。' },
    { role: 'CMO', industry: '零售品牌', challenge: '客戶資料分散在各個系統，營銷轉化率低，缺乏深度資料洞察。' },
    { role: '研發負責人', industry: '互聯網公司', challenge: '研發與業務脫節，項目進度難以把控，資源分配不合理。' },
  ],
  en: [
    { role: 'CFO', industry: 'Multinational Manufacturing', challenge: 'Cross-border travel expenses are chaotic, reconciliation is difficult, spending lacks transparency.' },
    { role: 'VP of Sales', industry: 'Tech Company', challenge: 'Sales-legal collaboration is slow, contract approvals drag, customer data gets lost.' },
    { role: 'CMO', industry: 'Retail Brand', challenge: 'Customer data scattered across systems, marketing conversion is low, we lack deep insights.' },
    { role: 'Head of R&D', industry: 'Internet Company', challenge: 'R&D is disconnected from business, progress is hard to track, resources allocated poorly.' },
  ],
  ja: [
    { role: 'CFO', industry: '多国籍製造企業', challenge: '国境を越えた出張経費は混乱しており、照合が困難で、経費の透明性が欠けています。' },
    { role: '営業VP', industry: 'テクノロジー企業', challenge: '営業と法務の連携が非効率で、契約承認が遅く、顧客データが頻繁に失われます。' },
    { role: 'CMO', industry: '小売ブランド', challenge: '顧客データはシステム全体に分散しており、マーケティングのコンバージョン率は低く、深いデータの洞察が不足しています。' },
    { role: 'R&D責任者', industry: 'インターネット企業', challenge: 'R&Dはビジネスから切り離されており、プロジェクトの進捗管理が難しく、リソースの割り当てが不合理です。' },
  ],
};

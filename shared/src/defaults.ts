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
    industries: [],
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
    industries: [],
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
    industries: [],
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
    industries: [],
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
    industries: [],
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
    industries: [],
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
    industries: [],
  },
  {
    id: 'SRM',
    name: {
      'zh-CN': '供应商关系管理 (SRM)',
      'zh-HK': '供應商關係管理 (SRM)',
      en: 'Supplier Relationship Management (SRM)',
      ja: 'サプライヤー関係管理 (SRM)',
    },
    description: {
      'zh-CN': '管理供应商准入、资质审核、合同履约、绩效评估与风险预警。解决供应商资料散乱、准入审核慢、履约风险不可见的痛点，支撑战略采购决策。',
      'zh-HK': '管理供應商准入、資質審核、合同履約、績效評估與風險預警。解決供應商資料散亂、准入審核慢、履約風險不可見的痛點，支撐戰略採購決策。',
      en: 'Manage supplier onboarding, qualification, contract performance, KPI scoring, and risk alerts. Tackles scattered records, slow intake, and invisible performance risk; informs strategic sourcing.',
      ja: 'サプライヤーのオンボーディング、資格審査、契約履行、KPI評価、リスクアラートを管理。散在した情報、遅い審査、不可視な履行リスクを解消し、戦略調達の意思決定を支援。',
    },
    audience: {
      'zh-CN': '采购总监、供应链VP、风控经理',
      'zh-HK': '採購總監、供應鏈VP、風控經理',
      en: 'Chief Procurement Officer, VP Supply Chain, Risk Manager',
      ja: '調達責任者、サプライチェーンVP、リスクマネージャー',
    },
    url: {
      google: {
        'zh-CN': 'https://cloud.google.com/solutions/procurement?hl=zh-CN',
        'zh-HK': 'https://cloud.google.com/solutions/procurement?hl=zh-TW',
        en: 'https://cloud.google.com/solutions/procurement',
        ja: 'https://cloud.google.com/solutions/procurement?hl=ja',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/procurement/',
        'zh-HK': 'https://aws.amazon.com/procurement/',
        en: 'https://aws.amazon.com/procurement/',
        ja: 'https://aws.amazon.com/jp/procurement/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
    industries: ['manufacturing', 'automotive', 'retail'],
  },
  {
    id: 'Settlement',
    name: {
      'zh-CN': '清结算系统',
      'zh-HK': '清結算系統',
      en: 'Clearing & Settlement System',
      ja: '清算・決済システム',
    },
    description: {
      'zh-CN': '面向跨境贸易和平台型企业的资金清分、分账、对账与差错处理。多币种、多通道（SWIFT / 本地银行 / 第三方支付）自动匹配，T+0 对账，差错回冲全程可追溯。',
      'zh-HK': '面向跨境貿易和平台型企業的資金清分、分賬、對賬與差錯處理。多幣種、多通道（SWIFT / 本地銀行 / 第三方支付）自動匹配，T+0 對賬，差錯回沖全程可追溯。',
      en: 'Clearing, split, reconciliation, and exception handling for cross-border and platform businesses. Multi-currency, multi-rail (SWIFT / local banks / PSPs) auto-matching, same-day reconciliation, traceable reversals.',
      ja: '越境取引やプラットフォーム事業向けの資金清算、分配、照合、例外処理。マルチ通貨・マルチチャネル（SWIFT / 現地銀行 / 決済代行）の自動照合、T+0照合、追跡可能な差戻し処理。',
    },
    audience: {
      'zh-CN': 'CFO、财务共享中心总监、资金经理',
      'zh-HK': 'CFO、財務共享中心總監、資金經理',
      en: 'CFO, Finance Shared Services Director, Treasury Manager',
      ja: 'CFO、経理シェアードサービス責任者、財務マネージャー',
    },
    url: {
      google: {
        'zh-CN': 'https://cloud.google.com/solutions/financial-services?hl=zh-CN',
        'zh-HK': 'https://cloud.google.com/solutions/financial-services?hl=zh-TW',
        en: 'https://cloud.google.com/solutions/financial-services',
        ja: 'https://cloud.google.com/solutions/financial-services?hl=ja',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/financial-services/payments/',
        'zh-HK': 'https://aws.amazon.com/financial-services/payments/',
        en: 'https://aws.amazon.com/financial-services/payments/',
        ja: 'https://aws.amazon.com/jp/financial-services/payments/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
    industries: ['finance', 'ecommerce', 'retail'],
  },
  {
    id: 'SCP',
    name: {
      'zh-CN': '供应链计划平台',
      'zh-HK': '供應鏈計劃平台',
      en: 'Supply Chain Planning Platform',
      ja: 'サプライチェーン計画プラットフォーム',
    },
    description: {
      'zh-CN': '整合需求预测、S&OP、库存计划、生产排程与分销规划。基于 AI 预测模型自动生成多情景（乐观 / 悲观 / 基线）计划，降低缺货率与在途库存占用。',
      'zh-HK': '整合需求預測、S&OP、庫存計劃、生產排程與分銷規劃。基於 AI 預測模型自動生成多情景（樂觀 / 悲觀 / 基線）計劃，降低缺貨率與在途庫存佔用。',
      en: 'Integrates demand forecasting, S&OP, inventory planning, production scheduling, and distribution. AI-driven multi-scenario plans (optimistic / pessimistic / baseline) to cut stockouts and working capital.',
      ja: '需要予測、S&OP、在庫計画、生産スケジュール、配送計画を統合。AIによる複数シナリオ（楽観 / 悲観 / ベースライン）計画を自動生成し、欠品と運転資本を削減。',
    },
    audience: {
      'zh-CN': '供应链总监、计划经理、生产运营VP',
      'zh-HK': '供應鏈總監、計劃經理、生產運營VP',
      en: 'Supply Chain Director, Planning Manager, VP Operations',
      ja: 'サプライチェーン責任者、計画マネージャー、オペレーションVP',
    },
    url: {
      google: {
        'zh-CN': 'https://cloud.google.com/solutions/supply-chain?hl=zh-CN',
        'zh-HK': 'https://cloud.google.com/solutions/supply-chain?hl=zh-TW',
        en: 'https://cloud.google.com/solutions/supply-chain',
        ja: 'https://cloud.google.com/solutions/supply-chain?hl=ja',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/supply-chain/',
        'zh-HK': 'https://aws.amazon.com/supply-chain/',
        en: 'https://aws.amazon.com/supply-chain/',
        ja: 'https://aws.amazon.com/jp/supply-chain/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
    industries: ['manufacturing', 'retail', 'logistics', 'automotive'],
  },
  {
    id: 'OMS',
    name: {
      'zh-CN': '订单管理系统 (OMS)',
      'zh-HK': '訂單管理系統 (OMS)',
      en: 'Order Management System (OMS)',
      ja: '注文管理システム (OMS)',
    },
    description: {
      'zh-CN': '统一线上线下多渠道订单，智能分单、库存占用、发货调度与售后处理。解决爆单错发、库存超卖、渠道数据割裂的痛点，提升履约时效与客户满意度。',
      'zh-HK': '統一線上線下多渠道訂單，智能分單、庫存佔用、發貨調度與售後處理。解決爆單錯發、庫存超賣、渠道資料割裂的痛點，提升履約時效與客戶滿意度。',
      en: 'Unifies omnichannel orders with smart routing, inventory allocation, fulfillment scheduling, and returns. Eliminates mis-shipments, overselling, and channel data silos while speeding up delivery.',
      ja: 'オムニチャネル注文を統合し、スマートルーティング、在庫引当、出荷スケジュール、返品処理を実現。誤配送、過剰販売、チャネル分断を解消し、配送速度と顧客満足度を向上。',
    },
    audience: {
      'zh-CN': 'COO、电商运营总监、履约中心负责人',
      'zh-HK': 'COO、電商運營總監、履約中心負責人',
      en: 'COO, E-commerce Ops Director, Head of Fulfillment',
      ja: 'COO、EC運営責任者、フルフィルメント責任者',
    },
    url: {
      google: {
        'zh-CN': 'https://cloud.google.com/solutions/commerce?hl=zh-CN',
        'zh-HK': 'https://cloud.google.com/solutions/commerce?hl=zh-TW',
        en: 'https://cloud.google.com/solutions/commerce',
        ja: 'https://cloud.google.com/solutions/commerce?hl=ja',
      },
      aws: {
        'zh-CN': 'https://aws.amazon.com/cn/retail/order-management/',
        'zh-HK': 'https://aws.amazon.com/retail/order-management/',
        en: 'https://aws.amazon.com/retail/order-management/',
        ja: 'https://aws.amazon.com/jp/retail/order-management/',
      },
    },
    isParticipating: true,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    ownerEmail: null,
    industries: ['ecommerce', 'retail'],
  },
];

/**
 * Quick scenarios shown on the landing page.
 * 4 fixed cards per language; click → auto-compose "我是<industry>的<role>，痛点是<challenge>".
 */
// Each lang has 8 scenarios picked to span the demo product catalog (CRM /
// CLM / Expense / Settlement / SCP / SRM / OMS / AgentBuilder). Lecturer
// can click any of them when voice fails or when the venue's too noisy to
// trust the mic. super_admin can edit at runtime via the admin panel
// (stored in global_config.quick_scenarios jsonb when overridden).
export const DEFAULT_QUICK_OPTIONS: Record<Lang, QuickOption[]> = {
  'zh-CN': [
    { role: '财务总监', industry: '跨国制造企业', challenge: '跨国团队差旅报销混乱，财务对账困难，缺乏费用透明度。', productIds: ['Expense'] },
    { role: '销售VP', industry: '科技公司', challenge: '销售与法务协作效率低，合同审批慢，客户数据经常丢失。', productIds: ['CRM', 'CLM'] },
    { role: 'CMO', industry: '零售品牌', challenge: '客户数据分散在各个系统，营销转化率低，缺乏深度数据洞察。', productIds: ['CRM'] },
    { role: '研发负责人', industry: '互联网公司', challenge: '研发与业务脱节，项目进度难以把控，资源分配不合理。', productIds: ['AgentBuilder'] },
    { role: '采购总监', industry: '汽车零部件供应商', challenge: '供应商数据散乱，比价靠 Excel 来回发邮件，价格谈判没有数据支撑。', productIds: ['SRM'] },
    { role: 'COO', industry: '电商平台', challenge: '订单分散在多个销售渠道，库存频繁出错，跨渠道履约慢，售后回款也对不上。', productIds: ['OMS', 'Settlement'] },
    { role: 'CTO', industry: '金融科技公司', challenge: '想给业务团队上一套智能体平台，让运营自己拖拽生成业务流，但担心数据安全和合规。', productIds: ['AgentBuilder'] },
    { role: '供应链总监', industry: '快消零售连锁', challenge: '门店补货依赖人工经验，节假日预测严重失准，门店缺货又总仓积压。', productIds: ['SCP'] },
  ],
  'zh-HK': [
    { role: '財務總監', industry: '跨國製造企業', challenge: '跨國團隊差旅報銷混亂，財務對賬困難，缺乏費用透明度。', productIds: ['Expense'] },
    { role: '銷售VP', industry: '科技公司', challenge: '銷售與法務協作效率低，合同審批慢，客戶資料經常丟失。', productIds: ['CRM', 'CLM'] },
    { role: 'CMO', industry: '零售品牌', challenge: '客戶資料分散在各個系統，營銷轉化率低，缺乏深度資料洞察。', productIds: ['CRM'] },
    { role: '研發負責人', industry: '互聯網公司', challenge: '研發與業務脫節，項目進度難以把控，資源分配不合理。', productIds: ['AgentBuilder'] },
    { role: '採購總監', industry: '汽車零部件供應商', challenge: '供應商資料散亂，比價靠 Excel 來回發郵件，價格談判沒有數據支撐。', productIds: ['SRM'] },
    { role: 'COO', industry: '電商平台', challenge: '訂單分散在多個銷售渠道，庫存頻繁出錯，跨渠道履約慢，售後回款也對不上。', productIds: ['OMS', 'Settlement'] },
    { role: 'CTO', industry: '金融科技公司', challenge: '想給業務團隊上一套智能體平台，讓運營自己拖拽生成業務流，但擔心資料安全和合規。', productIds: ['AgentBuilder'] },
    { role: '供應鏈總監', industry: '快消零售連鎖', challenge: '門店補貨依賴人工經驗，節假日預測嚴重失準，門店缺貨又總倉積壓。', productIds: ['SCP'] },
  ],
  en: [
    { role: 'CFO', industry: 'Multinational Manufacturing', challenge: 'Cross-border travel expenses are chaotic, reconciliation is difficult, spending lacks transparency.', productIds: ['Expense'] },
    { role: 'VP of Sales', industry: 'Tech Company', challenge: 'Sales-legal collaboration is slow, contract approvals drag, customer data gets lost.', productIds: ['CRM', 'CLM'] },
    { role: 'CMO', industry: 'Retail Brand', challenge: 'Customer data scattered across systems, marketing conversion is low, we lack deep insights.', productIds: ['CRM'] },
    { role: 'Head of R&D', industry: 'Internet Company', challenge: 'R&D is disconnected from business, progress is hard to track, resources allocated poorly.', productIds: ['AgentBuilder'] },
    { role: 'Procurement Director', industry: 'Auto Parts Supplier', challenge: 'Supplier data is scattered, RFQs bounce around in email and Excel, price negotiations lack data backing.', productIds: ['SRM'] },
    { role: 'COO', industry: 'E-commerce Platform', challenge: 'Orders span multiple sales channels, inventory drifts, fulfilment is slow, and after-sales settlement never reconciles.', productIds: ['OMS', 'Settlement'] },
    { role: 'CTO', industry: 'Fintech Company', challenge: 'Want to deploy an agent-builder platform so business teams can drag-and-drop workflows, but worried about data security and compliance.', productIds: ['AgentBuilder'] },
    { role: 'Supply Chain Director', industry: 'FMCG Retail Chain', challenge: 'Store replenishment relies on gut feel, holiday forecasts are wildly off, stores stock out while warehouses overflow.', productIds: ['SCP'] },
  ],
  ja: [
    { role: 'CFO', industry: '多国籍製造企業', challenge: '国境を越えた出張経費は混乱しており、照合が困難で、経費の透明性が欠けています。', productIds: ['Expense'] },
    { role: '営業VP', industry: 'テクノロジー企業', challenge: '営業と法務の連携が非効率で、契約承認が遅く、顧客データが頻繁に失われます。', productIds: ['CRM', 'CLM'] },
    { role: 'CMO', industry: '小売ブランド', challenge: '顧客データはシステム全体に分散しており、マーケティングのコンバージョン率は低く、深いデータの洞察が不足しています。', productIds: ['CRM'] },
    { role: 'R&D責任者', industry: 'インターネット企業', challenge: 'R&Dはビジネスから切り離されており、プロジェクトの進捗管理が難しく、リソースの割り当てが不合理です。', productIds: ['AgentBuilder'] },
    { role: '調達責任者', industry: '自動車部品サプライヤー', challenge: 'サプライヤー情報が分散しており、見積りは Excel とメールで往復、価格交渉にデータの裏付けがありません。', productIds: ['SRM'] },
    { role: 'COO', industry: 'EC プラットフォーム', challenge: '注文が複数の販売チャネルに分散し、在庫がずれ、クロスチャネル履行が遅く、アフターサービスの清算も合いません。', productIds: ['OMS', 'Settlement'] },
    { role: 'CTO', industry: 'フィンテック企業', challenge: '業務チームがドラッグ&ドロップで業務フローを構築できるエージェントビルダーを導入したいが、データセキュリティとコンプライアンスが懸念です。', productIds: ['AgentBuilder'] },
    { role: 'サプライチェーン責任者', industry: 'FMCG 小売チェーン', challenge: '店舗の補充は人の勘に頼っており、祝日の予測が大きく外れ、店舗で欠品し倉庫では過剰在庫になります。', productIds: ['SCP'] },
  ],
};

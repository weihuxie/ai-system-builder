-- ─────────────────────────────────────────────────────────────
-- seed.sql — default product catalog (mirrors shared/src/defaults.ts)
-- Run AFTER 0001_init.sql. Idempotent: uses ON CONFLICT DO NOTHING
-- so re-running in local dev doesn't clobber edits.
--
-- Source of truth for these rows is shared/src/defaults.ts; if you edit
-- that file, regenerate this seed (or run the admin "Reset to defaults"
-- button against a real Supabase instance).
-- ─────────────────────────────────────────────────────────────

insert into public.products (id, name, description, audience, url, is_participating)
values
  (
    'CRM',
    jsonb_build_object(
      'zh-CN', '客户关系管理 (CRM)',
      'zh-HK', '客戶關係管理 (CRM)',
      'en',    'Customer Relationship Management (CRM)',
      'ja',    '顧客関係管理 (CRM)'
    ),
    jsonb_build_object(
      'zh-CN', '管理客户关系、销售漏斗、追踪客户互动，提升销售转化率。适用于销售团队协作效率低、客户数据丢失等痛点。',
      'zh-HK', '管理客戶關係、銷售漏斗、追蹤客戶互動，提升銷售轉化率。適用於銷售團隊協作效率低、客戶資料丟失等痛點。',
      'en',    'Manage customer relationships, sales pipelines, and customer interactions to boost conversion. Addresses low sales-team collaboration and data loss.',
      'ja',    '顧客関係、セールスパイプライン、インタラクションを管理し、コンバージョン率を向上させます。営業チームの連携不足や顧客データ紛失の課題に対応。'
    ),
    jsonb_build_object(
      'zh-CN', '销售总监、销售代表、客户成功经理',
      'zh-HK', '銷售總監、銷售代表、客戶成功經理',
      'en',    'Sales Director, Sales Rep, Customer Success Manager',
      'ja',    '営業部長、営業担当、カスタマーサクセスマネージャー'
    ),
    jsonb_build_object(
      'google', jsonb_build_object(
        'zh-CN', 'https://workspace.google.com/intl/zh-CN/',
        'zh-HK', 'https://workspace.google.com/intl/zh-HK/',
        'en',    'https://workspace.google.com/',
        'ja',    'https://workspace.google.com/intl/ja/'
      ),
      'aws', jsonb_build_object(
        'zh-CN', 'https://aws.amazon.com/cn/connect/',
        'zh-HK', 'https://aws.amazon.com/connect/',
        'en',    'https://aws.amazon.com/connect/',
        'ja',    'https://aws.amazon.com/jp/connect/'
      )
    ),
    true
  ),
  (
    'CLM',
    jsonb_build_object(
      'zh-CN', '合同生命周期管理 (CLM)',
      'zh-HK', '合同生命週期管理 (CLM)',
      'en',    'Contract Lifecycle Management (CLM)',
      'ja',    '契約ライフサイクル管理 (CLM)'
    ),
    jsonb_build_object(
      'zh-CN', '自动化合同创建、审批、签署和续约流程，降低法务风险。适用于法务与业务协作慢、合同审批繁琐等痛点。',
      'zh-HK', '自動化合同建立、審批、簽署和續約流程，降低法務風險。適用於法務與業務協作慢、合同審批繁瑣等痛點。',
      'en',    'Automate contract creation, approval, signature, and renewal to reduce legal risk. Addresses slow legal-business collaboration and cumbersome approvals.',
      'ja',    '契約書の作成、承認、署名、更新を自動化し、法的リスクを低減。法務と事業の連携遅延や複雑な承認プロセスの課題に対応。'
    ),
    jsonb_build_object(
      'zh-CN', '法务总监、销售VP、采购经理',
      'zh-HK', '法務總監、銷售VP、採購經理',
      'en',    'General Counsel, VP of Sales, Procurement Manager',
      'ja',    '法務責任者、営業VP、調達マネージャー'
    ),
    jsonb_build_object(
      'google', jsonb_build_object(
        'zh-CN', 'https://workspace.google.com/intl/zh-CN/',
        'zh-HK', 'https://workspace.google.com/intl/zh-HK/',
        'en',    'https://workspace.google.com/',
        'ja',    'https://workspace.google.com/intl/ja/'
      ),
      'aws', jsonb_build_object(
        'zh-CN', 'https://aws.amazon.com/cn/marketplace/',
        'zh-HK', 'https://aws.amazon.com/marketplace/',
        'en',    'https://aws.amazon.com/marketplace/',
        'ja',    'https://aws.amazon.com/jp/marketplace/'
      )
    ),
    true
  ),
  (
    'Expense',
    jsonb_build_object(
      'zh-CN', '报销与费用管理',
      'zh-HK', '報銷與費用管理',
      'en',    'Expense Management',
      'ja',    '経費精算管理'
    ),
    jsonb_build_object(
      'zh-CN', '追踪员工差旅报销，自动化审批流，提升财务对账效率和费用透明度。适用于跨国团队报销混乱、财务对账困难等痛点。',
      'zh-HK', '追蹤員工差旅報銷，自動化審批流，提升財務對賬效率和費用透明度。適用於跨國團隊報銷混亂、財務對賬困難等痛點。',
      'en',    'Track employee travel expenses, automate approvals, improve reconciliation and spend transparency. Addresses chaotic cross-border expenses.',
      'ja',    '従業員の出張経費を追跡し、承認フローを自動化、照合効率と経費の透明性を向上。多国籍チームの経費混乱の課題に対応。'
    ),
    jsonb_build_object(
      'zh-CN', '财务总监、会计、出纳',
      'zh-HK', '財務總監、會計、出納',
      'en',    'CFO, Accountant, Cashier',
      'ja',    '財務責任者、経理、出納'
    ),
    jsonb_build_object(
      'google', jsonb_build_object(
        'zh-CN', 'https://workspace.google.com/intl/zh-CN/',
        'zh-HK', 'https://workspace.google.com/intl/zh-HK/',
        'en',    'https://workspace.google.com/',
        'ja',    'https://workspace.google.com/intl/ja/'
      ),
      'aws', jsonb_build_object(
        'zh-CN', 'https://aws.amazon.com/cn/marketplace/',
        'zh-HK', 'https://aws.amazon.com/marketplace/',
        'en',    'https://aws.amazon.com/marketplace/',
        'ja',    'https://aws.amazon.com/jp/marketplace/'
      )
    ),
    true
  )
on conflict (id) do nothing;

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

import { useProductsQuery } from '../lib/queries';
import { useAppStore } from '../lib/store';
import { t } from '../lib/translations';

/**
 * Summit 断网兜底提示条。
 *
 * 触发条件（任一即显示）：
 *   - navigator.onLine === false（浏览器主动检测）
 *   - products query 本轮 fetch 有 error（可能是 5xx / CORS / 超时 / 梯子挂掉）
 *
 * 只提示「展示缓存产品 + AI 暂不可用」—— 不替 AI 编造推荐。产品列表靠
 * useProductsQuery 的 initialData 兜底（localStorage 缓存 → DEFAULT_PRODUCTS）。
 *
 * 讲师视角：网络恢复后 React Query 自动 refetch，error 清空 → banner 自动隐藏。
 */
export default function OfflineBanner() {
  const lang = useAppStore((s) => s.lang);
  const productsQuery = useProductsQuery();
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  // productsQuery.error is set whenever the latest fetch failed. React Query
  // keeps `data` as the initial cached value, so the bottom list still renders.
  const productsErrored = !!productsQuery.error;
  const isOffline = !online || productsErrored;
  if (!isOffline) return null;

  const ui = t(lang);
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-6xl px-4 sm:px-6 mt-3"
    >
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
        <WifiOff size={16} className="mt-0.5 shrink-0" />
        <div className="text-sm leading-relaxed">
          <div className="font-medium">{ui.offlineBannerTitle}</div>
          <div className="text-amber-200/80">{ui.offlineBannerHint}</div>
        </div>
      </div>
    </div>
  );
}

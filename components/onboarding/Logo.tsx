/** Logo do FinFinance (o F com as barras). `size` é a largura em px. */
export default function Logo({ size = 56 }: { size?: number; animate?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/mark.webp" alt="FinFinance" width={size} height={Math.round((size * 424) / 368)} className="ff-logo-img shrink-0 select-none" draggable={false} />
  );
}

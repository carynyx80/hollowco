export function Ring({ size = 32, pulse = false, dark = false }: { size?: number; pulse?: boolean; dark?: boolean }) {
  const stroke = dark ? '#FBF8F2' : '#2B2B2B';
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <circle cx="256" cy="256" r="158" fill="none" stroke={stroke} strokeWidth="64" />
      {pulse && <circle className="dot-ping" cx="318" cy="306" r="22" fill="#FF8A70" />}
      <circle cx="318" cy="306" r="22" fill="#FF8A70" />
    </svg>
  );
}
export function Wordmark({ dark = false }: { dark?: boolean }) {
  return <span className="flex items-center gap-2 font-semibold tracking-tight text-[17px]"><Ring size={26} dark={dark} />HollowCo</span>;
}

export function Ring({ size = 32, pulse = false }: { size?: number; pulse?: boolean; dark?: boolean }) {
  const id = 'hc' + size;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".55" stopColor="#D4B98A" /><stop offset="1" stopColor="#B8975A" /></linearGradient>
        <linearGradient id={id + 'd'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A9B4A6" /><stop offset="1" stopColor="#B8975A" /></linearGradient></defs>
      <circle cx="256" cy="256" r="158" fill="none" stroke={`url(#${id})`} strokeWidth="64" />
      {pulse && <circle className="dot-ping" cx="318" cy="306" r="22" fill="#A9B4A6" />}
      <circle cx="318" cy="306" r="24" fill={`url(#${id}d)`} />
    </svg>
  );
}
export function Wordmark() {
  return <span className="flex items-center gap-2 font-semibold tracking-tight text-[17px]"><Ring size={26} />HollowCo</span>;
}

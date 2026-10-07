export function BrandLogo({
  inverted = false,
  compact = false,
}: {
  inverted?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      aria-label="B1G Fuel"
      className={`flex items-center gap-3 ${inverted ? "text-white" : "text-[#02066F]"} ${compact ? "flex-row-reverse" : ""}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 72"
        className={compact ? "h-16 w-11" : "h-20 w-14"}
      >
        <path
          fill="currentColor"
          d="M24 0C19 13 2 30 2 45c0 12 8 22 19 26-5-6-9-12-8-19 1-8 8-12 12-20 0 9 9 12 10 20 1 7-3 13-8 19 11-3 19-14 19-26C46 30 31 13 24 0Z"
        />
      </svg>
      <div className="flex flex-col">
        <span
          className={`${compact ? "text-[42px]" : "text-[58px]"} font-black leading-[0.95] tracking-[-0.045em]`}
        >
          B1G
        </span>
        <span
          className={`${compact ? "mt-1 text-[13px]" : "mt-2 text-[17px]"} pl-1 font-medium tracking-[0.62em]`}
        >
          FUEL
        </span>
      </div>
    </div>
  );
}

import Image from "next/image";

export function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="grid shrink-0 place-items-center overflow-hidden">
        <Image
          alt=""
          className="h-full w-full scale-[2] object-contain"
          height={30}
          priority
          src="/logo.png"
          width={25}
        />
      </span>
      <span className="text-sm font-extrabold tracking-[0.14em]">UPSCALE</span>
    </span>
  );
}

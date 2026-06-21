/** the World Cup trophy (replaces the 🏆 emoji app-wide); AI-generated
 * public-domain image — see COPYRIGHT.md */
const TROPHY_SRC = `${import.meta.env.BASE_URL}icons/trophy.png`

export default function Trophy({ size = 16 }: { size?: number }) {
  return (
    <img
      className="trophy-img"
      src={TROPHY_SRC}
      alt=""
      height={size}
      width={Math.round(size * (55 / 128))}
      loading="lazy"
    />
  )
}

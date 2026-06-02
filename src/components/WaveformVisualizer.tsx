/**
 * WaveformVisualizer.tsx
 * Animación de barras que indica actividad de audio.
 */

'use client'

interface Props {
  active: boolean
  color?: string  // clase Tailwind bg-*
  barCount?: number
}

export default function WaveformVisualizer({
  active,
  color = 'bg-accent-es',
  barCount = 7,
}: Props) {
  if (!active) return null

  return (
    <div className="flex items-end gap-[3px] h-8">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={`waveform-bar ${color} w-[3px] rounded-sm`}
          style={{
            height: '100%',
            animationDelay: `${i * 0.07}s`,
            animationDuration: `${0.5 + (i % 3) * 0.15}s`,
          }}
        />
      ))}
    </div>
  )
}

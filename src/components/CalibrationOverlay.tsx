/**
 * CalibrationOverlay
 * 
 * Displays "CALIBRATING" with a Bio-Phosphor progress bar.
 * No spinners — ever. This is Studio Animata.
 */

const CalibrationOverlay = () => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background">
      <h1 className="font-syne text-4xl font-extrabold tracking-wider text-foreground">
        CALIBRATING
      </h1>
      <div className="h-[2px] w-48 bg-muted overflow-hidden">
        <div className="h-full bg-primary animate-calibrate" />
      </div>
    </div>
  );
};

export default CalibrationOverlay;

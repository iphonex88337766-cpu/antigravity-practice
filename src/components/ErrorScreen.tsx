/**
 * ErrorScreen
 * 
 * Full-screen takeover in Signal-Loss Red.
 * The webcam view vanishes. A single message commands attention.
 * This is not a toast. This is a system failure.
 */

interface ErrorScreenProps {
  message: string;
}

const ErrorScreen = ({ message }: ErrorScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-destructive">
      <h1 className="font-syne text-5xl font-extrabold tracking-wider text-destructive-foreground md:text-7xl">
        {message}
      </h1>
    </div>
  );
};

export default ErrorScreen;

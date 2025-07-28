export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Welcome to Apex Flow
        </h1>
        <p className="text-center text-lg text-muted-foreground">
          Gamified Life Management Application
        </p>
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Frontend application is running successfully!
          </p>
        </div>
      </div>
    </main>
  )
}
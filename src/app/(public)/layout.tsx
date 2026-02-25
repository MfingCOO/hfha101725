export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl space-y-8">
        {children}
      </div>
    </main>
  );
}

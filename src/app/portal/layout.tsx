export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </div>
      <footer className="text-center text-gray-400 text-xs pb-8">
        Powered by CommandPost
      </footer>
    </div>
  );
}

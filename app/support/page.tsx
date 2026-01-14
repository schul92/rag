export const metadata = {
  title: 'Support - 찬양팀 악보',
  description: 'Get help and support for 찬양팀 악보 (Worship Song Finder)',
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Support / 고객 지원</h1>
      <p className="text-muted-foreground mb-4">
        We&apos;re here to help! Find answers to common questions below.
      </p>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">About the App / 앱 소개</h2>
        <p className="text-muted-foreground">
          찬양팀 악보 (Worship Song Finder) is an AI-powered app that helps worship teams
          find chord sheets quickly and easily. Search by song title, lyrics, or key to
          find the music you need for your worship service.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">How to Use / 사용 방법</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-2">
          <li><strong>Search by title:</strong> Enter the song name (e.g., &quot;Holy Forever&quot;, &quot;나는 믿네&quot;)</li>
          <li><strong>Search by lyrics:</strong> Type any lyrics you remember (e.g., &quot;Amazing grace&quot;, &quot;주님의 사랑&quot;)</li>
          <li><strong>Search by key:</strong> Find songs in a specific key (e.g., &quot;G key songs&quot;, &quot;A키 찬양&quot;)</li>
          <li><strong>Request more results:</strong> Add a number to get more sheets (e.g., &quot;5개&quot;, &quot;show 5&quot;)</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Frequently Asked Questions</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">How do I change the language?</h3>
            <p className="text-muted-foreground text-sm">
              Open Settings (gear icon) and tap on &quot;Language&quot; to switch between Korean and English.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-1">How do I switch to dark/light mode?</h3>
            <p className="text-muted-foreground text-sm">
              Open Settings and tap on &quot;Dark Mode&quot; to toggle between dark and light themes.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-1">Can I download chord sheets?</h3>
            <p className="text-muted-foreground text-sm">
              Yes! Tap on any chord sheet to view it larger, then use the download button to save it.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-1">What if I can&apos;t find a song?</h3>
            <p className="text-muted-foreground text-sm">
              Try searching with different keywords, partial lyrics, or the original language title.
              If the song isn&apos;t in our database, the app will search the web for results.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-1">How do I clear my search history?</h3>
            <p className="text-muted-foreground text-sm">
              Open Settings and tap &quot;Clear Cache&quot; under the Data section to remove saved data.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Troubleshooting / 문제 해결</h2>
        <ul className="list-disc list-inside text-muted-foreground space-y-2">
          <li><strong>App not loading:</strong> Check your internet connection and try restarting the app.</li>
          <li><strong>Search not working:</strong> Try simpler search terms or clear the cache in Settings.</li>
          <li><strong>Images not displaying:</strong> Ensure you have a stable internet connection.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Contact Us / 문의하기</h2>
        <p className="text-muted-foreground">
          If you have questions, feedback, or need help, please contact us:
        </p>
        <div className="mt-3 space-y-2">
          <p className="text-muted-foreground">
            <strong>Email:</strong>{' '}
            <a href="mailto:support@findmyworship.com" className="text-orange-500 hover:underline">
              support@findmyworship.com
            </a>
          </p>
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          We typically respond within 24-48 hours.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Feature Requests / 기능 요청</h2>
        <p className="text-muted-foreground">
          Have an idea to improve the app? We&apos;d love to hear from you!
          Send your suggestions to{' '}
          <a href="mailto:support@findmyworship.com" className="text-orange-500 hover:underline">
            support@findmyworship.com
          </a>
          {' '}with &quot;Feature Request&quot; in the subject line.
        </p>
      </section>
    </div>
  );
}

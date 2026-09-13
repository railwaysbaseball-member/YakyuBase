import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | レールウェイズ 成績管理",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-foreground/80">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">プライバシーポリシー</h1>
        <p className="text-sm text-foreground/50">最終更新日: 2026年9月13日</p>
      </div>

      <p className="text-sm text-foreground/80">
        草野球チーム「レールウェイズ」（以下「当チーム」）は、本サイト（以下「本サイト」）で取得する情報の取り扱いについて、以下の通りプライバシーポリシーを定めます。
      </p>

      <Section title="1. 取得する情報">
        <p>本サイトでは、以下の情報を取得することがあります。</p>
        <ul className="list-disc pl-5">
          <li>選手名・背番号・守備位置などの選手情報</li>
          <li>試合結果・打撃/投手/守備成績などのプレー記録</li>
          <li>スケジュールへの出欠情報</li>
          <li>ログインアカウントに紐づくメールアドレス（メンバーのみ）</li>
        </ul>
      </Section>

      <Section title="2. 利用目的">
        <p>取得した情報は、以下の目的の範囲内で利用します。</p>
        <ul className="list-disc pl-5">
          <li>試合結果・個人成績・スケジュールの記録および閲覧提供</li>
          <li>チームメンバーへの出欠確認・連絡</li>
          <li>ログイン機能の提供（本人確認）</li>
        </ul>
      </Section>

      <Section title="3. 第三者提供・委託先">
        <p>
          本サイトはデータの保存・認証基盤として Supabase
          社のサービスを利用しています。取得した情報はサービス提供に必要な範囲で同社のインフラ上に保存されますが、当チームの許可なく第三者に販売・提供することはありません。
        </p>
      </Section>

      <Section title="4. 広告・Cookieについて">
        <p>
          本サイトは第三者配信事業者（Google
          を含む）の広告を利用する場合があります。第三者配信事業者は、ユーザーの本サイトや他のサイトへのアクセス情報に基づいて広告を配信するために、Cookie（当サイトへの過去のアクセス情報を示すもの）を使用することがあります。
        </p>
        <p>
          Google 広告 Cookie の使用により、Google
          やそのパートナーは、ユーザーが本サイトや他のサイトにアクセスした際の情報に基づいて広告を配信します。ユーザーは
          <a
            href="https://adssettings.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-team-red underline"
          >
            広告設定
          </a>
          でパーソナライズ広告を無効にできます。
        </p>
      </Section>

      <Section title="5. アクセス解析について">
        <p>
          本サイトはアクセス状況の把握のため、Google が提供するアクセス解析ツール「Google
          アナリティクス」を利用しています。Google アナリティクスは、Cookie
          を使用してユーザーのアクセス情報を収集しますが、氏名・メールアドレスなど個人を特定する情報は含まれません。この機能は
          Cookie
          を無効にすることで収集を拒否できます。詳細は
          <a
            href="https://marketingplatform.google.com/about/analytics/terms/jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-team-red underline"
          >
            Google アナリティクス利用規約
          </a>
          をご確認ください。
        </p>
      </Section>

      <Section title="6. 情報の開示・削除">
        <p>
          チームメンバー本人から、自身に関する情報の開示・訂正・削除を求められた場合は、内容を確認の上、合理的な範囲で速やかに対応します。
        </p>
      </Section>

      <Section title="7. プライバシーポリシーの変更">
        <p>
          本ポリシーの内容は、必要に応じて予告なく変更することがあります。変更後の内容は本ページに掲載した時点から効力を持つものとします。
        </p>
      </Section>

      <Section title="8. お問い合わせ">
        <p>
          本ポリシーに関するお問い合わせは、下記メールアドレスまでご連絡ください。
          <br />
          <a href="mailto:railwaysbaseball@gmail.com" className="text-team-red underline">
            railwaysbaseball@gmail.com
          </a>
        </p>
      </Section>
    </div>
  );
}

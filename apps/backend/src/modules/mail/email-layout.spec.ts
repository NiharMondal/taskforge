import { emailLayout } from "./email-layout";

describe("emailLayout", () => {
  const render = (url: string) =>
    emailLayout({
      heading: "Heading",
      body: "Body",
      buttonLabel: "Go",
      url,
      footer: "Footer",
    });

  it("HTML-escapes the URL in the button and in the spelled-out link", () => {
    const html = render(
      'https://app.example/x?a=1&b="><script>alert(1)</script>',
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"><');
    expect(html).toContain(
      'href="https://app.example/x?a=1&amp;b=&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"',
    );
    // The button's href, the link's href and the link's text.
    expect(html.match(/&lt;script&gt;/g)).toHaveLength(3);
  });

  it("places the other parts as given", () => {
    const html = render("https://app.example/");

    expect(html).toContain("Heading");
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("Go");
    expect(html).toContain("Footer");
  });
});

// Illustrative login page for discovery (form + selectors).
export default function LoginPage() {
  return (
    <form data-testid="login-form">
      <input data-testid="login-email-input" name="email" type="email" placeholder="Email" required />
      <input data-testid="login-password-input" name="password" type="password" placeholder="Password" required />
      <button data-testid="login-submit-button" type="submit">
        تسجيل الدخول
      </button>
    </form>
  );
}

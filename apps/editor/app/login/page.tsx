import LoginForm from "../../components/LoginForm";
export const dynamic = "force-dynamic";
export default function LoginPage() {
  return (
    <section className="login-card">
      <h1>Sign in</h1>
      <p>Open your articles and private project ideas.</p>
      <LoginForm />
    </section>
  );
}

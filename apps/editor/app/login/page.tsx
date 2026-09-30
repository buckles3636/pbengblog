import LoginForm from "../../components/LoginForm";
export const dynamic = "force-dynamic";
export default function LoginPage() {
  return (
    <section className="login-card">
      <p className="eyebrow">Your notebook</p>
      <h1>Sign in to write.</h1>
      <p>Projects, working notes, and ideas. Pick up where you left off.</p>
      <LoginForm />
    </section>
  );
}

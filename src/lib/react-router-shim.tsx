// Compatibility shim that maps the small subset of react-router-dom APIs the
// source repo uses onto @tanstack/react-router. This lets us mirror the
// upstream pages/components verbatim without rewriting all navigation calls.
import * as React from "react";
import {
  Link as TSLink,
  useNavigate as tsUseNavigate,
  useLocation as tsUseLocation,
  useRouter,
} from "@tanstack/react-router";

// ---------- useNavigate ----------
export function useNavigate() {
  const navigate = tsUseNavigate();
  return (to: string | number, opts?: { replace?: boolean }) => {
    if (typeof to === "number") {
      // history.go(n) — TanStack exposes router.history.go()
      // Fallback: only -1 supported via window.history
      if (typeof window !== "undefined") window.history.go(to);
      return;
    }
    navigate({ to: to as any, replace: opts?.replace });
  };
}

// ---------- useLocation ----------
export function useLocation() {
  const loc = tsUseLocation();
  return {
    pathname: loc.pathname,
    search: loc.searchStr ?? "",
    hash: loc.hash ?? "",
    state: (loc as any).state ?? null,
    key: (loc as any).href ?? loc.pathname,
  };
}

// ---------- useParams ----------
export { useParams } from "@tanstack/react-router";

// ---------- Link ----------
type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;
interface LinkProps extends Omit<AnchorProps, "href"> {
  to: string;
  replace?: boolean;
  state?: unknown;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace, state: _state, children, ...rest }, ref) => {
    return (
      <TSLink ref={ref as any} to={to as any} replace={replace} {...(rest as any)}>
        {children}
      </TSLink>
    );
  },
);
Link.displayName = "Link";

// ---------- NavLink ----------
type NavLinkClassName = string | ((args: { isActive: boolean; isPending: boolean }) => string);
type NavLinkChildren =
  | React.ReactNode
  | ((args: { isActive: boolean; isPending: boolean }) => React.ReactNode);

export interface NavLinkProps extends Omit<AnchorProps, "href" | "className" | "children"> {
  to: string;
  end?: boolean;
  replace?: boolean;
  className?: NavLinkClassName;
  children?: NavLinkChildren;
}

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, end, replace, className, children, ...rest }, ref) => {
    const router = useRouter();
    const currentPath = router.state.location.pathname;
    const isActive = end ? currentPath === to : currentPath === to || currentPath.startsWith(to + "/");
    const args = { isActive, isPending: false };
    const resolvedClassName =
      typeof className === "function" ? className(args) : className;
    const resolvedChildren =
      typeof children === "function" ? (children as any)(args) : children;
    return (
      <TSLink
        ref={ref as any}
        to={to as any}
        replace={replace}
        className={resolvedClassName}
        {...(rest as any)}
      >
        {resolvedChildren}
      </TSLink>
    );
  },
);
NavLink.displayName = "NavLink";

// ---------- Navigate (component) ----------
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = tsUseNavigate();
  React.useEffect(() => {
    navigate({ to: to as any, replace });
  }, [to, replace, navigate]);
  return null;
}

// ---------- BrowserRouter / Routes / Route (no-op shims) ----------
// The source's App.tsx wraps everything in <BrowserRouter><Routes>...</Routes></BrowserRouter>
// but in TanStack Start the router is provided at the framework level via
// __root.tsx. These shims swallow the JSX so the pages still mount cleanly
// when imported individually. We don't actually use App.tsx.
export const BrowserRouter = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);
export const Routes = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Route = (_props: any) => null;
export const Outlet = () => null;

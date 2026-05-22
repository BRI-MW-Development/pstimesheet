import clsx from 'clsx';

export default function Badge({ children, variant = 'default' }) {
  return <span className={clsx('badge', `badge-${variant}`)}>{children}</span>;
}

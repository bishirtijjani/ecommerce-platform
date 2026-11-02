import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

export default function NotFound() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <EmptyState
          icon={Home}
          title="Page not found"
          subtitle="The page you’re looking for doesn’t exist or has been moved."
          action={
            <Link to="/">
              <Button>Back to dashboard</Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}

import { Button } from '@/components/ui/button';

interface ConflictDialogProps {
  artifactName: string;
  targetProject: string;
  onKeep: () => void;
  onReplace: () => void;
}

export function ConflictDialog({ artifactName, targetProject, onKeep, onReplace }: ConflictDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onKeep} />
      <div className="relative bg-background border border-border rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold mb-2">File already exists</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {artifactName} already exists in {targetProject}. Do you want to replace it?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onKeep}>Keep Original</Button>
          <Button variant="destructive" size="sm" onClick={onReplace}>Replace File</Button>
        </div>
      </div>
    </div>
  );
}

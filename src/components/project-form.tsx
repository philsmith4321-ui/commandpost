import type { Project } from '@/lib/types';

interface ProjectFormProps {
  action: (formData: FormData) => Promise<void>;
  clientId: number;
  project?: Project;
  submitLabel: string;
}

export function ProjectForm({ action, clientId, project, submitLabel }: ProjectFormProps) {
  const inputClass =
    'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500';

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="client_id" value={clientId} />
      {project && <input type="hidden" name="id" value={project.id} />}

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          defaultValue={project?.name ?? ''}
          placeholder="Project name"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={project?.status ?? 'active'}
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Start Date
          </label>
          <input
            type="date"
            name="start_date"
            defaultValue={project?.start_date ?? ''}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Server IP
          </label>
          <input
            type="text"
            name="server_ip"
            defaultValue={project?.server_ip ?? ''}
            placeholder="e.g. 165.227.185.182"
            className={`${inputClass} font-mono`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Repo URL
          </label>
          <input
            type="url"
            name="repo_url"
            defaultValue={project?.repo_url ?? ''}
            placeholder="https://github.com/..."
            className={`${inputClass} font-mono`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Deploy Command
        </label>
        <textarea
          name="deploy_command"
          rows={3}
          defaultValue={project?.deploy_command ?? ''}
          placeholder="e.g. ssh user@host 'cd /app && git pull && pm2 restart all'"
          className={`${inputClass} font-mono`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Stack Notes
        </label>
        <textarea
          name="stack_notes"
          rows={3}
          defaultValue={project?.stack_notes ?? ''}
          placeholder="Next.js 15, SQLite, Tailwind, etc."
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </form>
  );
}

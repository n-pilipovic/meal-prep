import { Injectable } from '@angular/core';
import { WeeklyPlan } from '../../core/models/meal.model';

@Injectable({ providedIn: 'root' })
export class JsonExportService {
  exportPlan(plan: WeeklyPlan, filename?: string): void {
    const json = JSON.stringify(plan, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `meal-plan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  importPlan(file: File): Promise<WeeklyPlan> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const plan = JSON.parse(reader.result as string) as WeeklyPlan;
          if (!plan.days || !Array.isArray(plan.days)) {
            reject(new Error('Neispravan format plana'));
            return;
          }
          resolve(plan);
        } catch {
          reject(new Error('Nije moguće pročitati JSON fajl'));
        }
      };
      reader.onerror = () => reject(new Error('Greška pri čitanju fajla'));
      reader.readAsText(file);
    });
  }
}

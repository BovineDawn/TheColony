import type { Department } from '../types/agent'

export const departmentColors: Record<Department, string> = {
  executive:   '#00D4FF',
  engineering: '#06B6D4',
  research:    '#8B5CF6',
  writing:     '#10B981',
  legal:       '#F59E0B',
  ld:          '#EC4899',
}

export const departmentLabels: Record<Department, string> = {
  executive:   'Executive',
  engineering: 'Engineering',
  research:    'Research',
  writing:     'Writing',
  legal:       'Legal',
  ld:          'Learning & Development',
}

export const departmentIcons: Record<Department, string> = {
  executive:   '◆',
  engineering: '⚙',
  research:    '◎',
  writing:     '✦',
  legal:       '⚖',
  ld:          '★',
}

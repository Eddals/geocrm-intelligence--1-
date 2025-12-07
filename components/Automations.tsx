import React from 'react';
import { AutomationRule } from '../types';
import { Zap, Bot, Mail, Tag, CheckCircle2, AlertCircle } from 'lucide-react';

interface AutomationsProps {
  rules: AutomationRule[];
  toggleRule: (id: string) => void;
}

const Automations: React.FC<AutomationsProps> = ({ rules, toggleRule }) => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-500" />
          Automação de Fluxo de Trabalho
        </h2>
        <p className="text-gray-500 mt-2">
          Configure robôs inteligentes para automatizar tarefas repetitivas e aumentar a produtividade do seu time.
        </p>
      </div>

      <div className="grid gap-4">
        {rules.map((rule) => (
          <div 
            key={rule.id}
            className={`p-6 rounded-xl border transition-all duration-200 flex items-start gap-4 ${
                rule.active 
                ? 'bg-white border-indigo-200 shadow-md shadow-indigo-50' 
                : 'bg-gray-50 border-gray-200 opacity-75'
            }`}
          >
            <div className={`p-3 rounded-lg ${rule.active ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                {rule.action === 'ENRICH_DATA' && <Bot className="w-6 h-6" />}
                {rule.action === 'SEND_EMAIL' && <Mail className="w-6 h-6" />}
                {rule.action === 'ADD_TAG_VIP' && <Tag className="w-6 h-6" />}
                {rule.action === 'NOTIFY_WIN' && <CheckCircle2 className="w-6 h-6" />}
            </div>

            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">{rule.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                    </div>
                    <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input 
                            type="checkbox" 
                            name={`toggle-${rule.id}`} 
                            id={`toggle-${rule.id}`} 
                            checked={rule.active}
                            onChange={() => toggleRule(rule.id)}
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-200"
                            style={{ 
                                right: rule.active ? '0' : 'auto', 
                                left: rule.active ? 'auto' : '0',
                                borderColor: rule.active ? '#4f46e5' : '#d1d5db'
                            }}
                        />
                        <label 
                            htmlFor={`toggle-${rule.id}`} 
                            className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ${
                                rule.active ? 'bg-indigo-600' : 'bg-gray-300'
                            }`}
                        ></label>
                    </div>
                </div>
                
                <div className="mt-4 flex gap-2">
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Gatilho: {rule.trigger}
                    </span>
                    <span className="text-xs font-mono bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Ação: {rule.action}
                    </span>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Automations;
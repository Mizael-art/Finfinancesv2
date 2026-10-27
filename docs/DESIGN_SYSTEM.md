

## Backup: exportar e importar (Etapa 11)

- `components/settings/DataSection` — dois botões (mesmo estilo dos botões secundários), texto de apoio com a última exportação e dois `Sheet`: erro ("Não foi possível importar", quadro vermelho) e confirmação (tabela "Agora → Backup" com `tabular-nums`, aviso amarelo, quadro vermelho de substituição e botões Baixar cópia / Substituir (`DangerButton`) / Cancelar).
- `components/settings/DriveSection` — dentro do card Backup, abaixo de `DataSection`: estado (Conectado/Backup pendente em badge), botões secundários, switch de backup automático e `Sheet`s não descartáveis (encontrado, conflito, ilegível, confirmações) com botões Restaurar / Usar dados deste dispositivo (`DangerButton` quando substitui dados). Sem novos tokens visuais.

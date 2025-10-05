# Nomenclatura de Estados/Províncias

## Mudança Implementada

A nomenclatura de estados/províncias foi padronizada para usar **códigos/prefixos** em vez de nomes completos, seguindo a estrutura do repositório de leis.

### Antes
- Interface: "Rio Grande do Sul"
- Código: "rs" (minúsculo)
- Estrutura: inconsistente

### Depois
- Interface: "RS" 
- Código: "RS" (maiúsculo)
- Estrutura: `country-br/state-RS/city-porto-alegre`

## Arquivos Alterados

### Interface do Usuário
- `src/ui/app.html` - Placeholders e textos de ajuda
- `src/ui/search_toc.html` - Caminhos de documentos

### Testes
- `tests/home-settings.integration.test.js` - Configurações de teste
- `tests/workspace-workflow.test.js` - Fluxos de trabalho
- Todos os valores de estado atualizados para formato maiúsculo

### Documentação
- `README.md` - Estrutura de exemplo atualizada

## Exemplos de Uso

### Configuração de Jurisdição
```javascript
{
  country: 'br',
  state: 'RS',        // Prefixo maiúsculo
  city: 'porto-alegre'
}
```

### Estrutura de Repositório
```
legal-corpus/
├── country-br/
│   ├── federal/
│   └── state/
│       └── RS/           # Prefixo maiúsculo
│           └── city/
│               └── porto-alegre/
```

### Interface
- Campo Estado/Província: placeholder "ex: RS"
- Texto de ajuda: "Código do estado ou província (ex: RS, SP, RJ)"

## Benefícios

1. **Consistência**: Alinhamento com estrutura do repositório
2. **Simplicidade**: Códigos curtos são mais fáceis de digitar
3. **Padronização**: Formato uniforme em todo o projeto
4. **Compatibilidade**: Segue padrões de códigos de estado brasileiros

## Migração

Para usuários existentes, as configurações antigas serão automaticamente convertidas para o novo formato na próxima atualização das configurações.
import './symbol-polyfill.js'

import type { z } from 'zod'

import type * as types from './types.js'
import { AIFunctionSet } from './ai-function-set.js'
import { createAIFunction } from './create-ai-function.js'
import { assert } from './utils.js'

export interface PrivateAIFunctionMetadata {
  name: string
  description: string
  inputSchema: z.AnyZodObject
  methodName: string

  // TODO
  // pre and post
}

export abstract class AIFunctionsProvider {
  private _functions?: AIFunctionSet

  get functions(): AIFunctionSet {
    if (!this._functions) {
      const metadata = this.constructor[Symbol.metadata]
      assert(metadata)
      const invocables =
        (metadata?.invocables as PrivateAIFunctionMetadata[]) ?? []
      // console.log({ metadata, invocables })

      const aiFunctions = invocables.map((invocable) => {
        const impl = (this as any)[invocable.methodName]
        assert(impl)

        return createAIFunction(invocable, impl)
      })

      this._functions = new AIFunctionSet(aiFunctions)
    }

    return this._functions
  }
}

export function aiFunction<
  This extends AIFunctionsProvider,
  InputSchema extends z.SomeZodObject,
  OptionalArgs extends Array<undefined>,
  Return extends types.MaybePromise<any>
>({
  name,
  description,
  inputSchema
}: {
  name?: string
  description: string
  inputSchema: InputSchema
}) {
  return (
    _targetMethod: (
      this: This,
      input: z.infer<InputSchema>,
      ...optionalArgs: OptionalArgs
    ) => Return,
    context: ClassMethodDecoratorContext<
      This,
      (
        this: This,
        input: z.infer<InputSchema>,
        ...optionalArgs: OptionalArgs
      ) => Return
    >
  ) => {
    const methodName = String(context.name)
    if (!context.metadata.invocables) {
      context.metadata.invocables = []
    }
    ;(context.metadata.invocables as PrivateAIFunctionMetadata[]).push({
      name: name ?? methodName,
      description,
      inputSchema,
      methodName
    })

    // console.log({
    //   name,
    //   methodName,
    //   context
    // })

    context.addInitializer(function () {
      ;(this as any)[methodName] = (this as any)[methodName].bind(this)
    })
  }
}

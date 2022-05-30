import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers,Contract, utils } from "ethers"
import Head from "next/head"
import React from "react"
import {Button, TextField} from '@mui/material'
import {useForm} from 'react-hook-form'
import styles from "../styles/Home.module.css"
import Greeter from "../artifacts/contracts/Greeters.sol/Greeters.json"
import * as yup from 'yup';

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const {register,handleSubmit}=useForm();
    const [data,setData]=React.useState("")
    const [textBox,setTextBox]=React.useState("")
  
   

    React.useEffect(()=>{
        const listen =async function () {
            const provider = (await detectEthereumProvider()) as any
    
            await provider.request({ method: "eth_requestAccounts" })
    
            const ethersProvider = new providers.Web3Provider(provider)
            const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi,ethersProvider)
            contract.on(contract.filters.NewGreeting(),(greet:string)=>{
                setTextBox(utils.parseBytes32String(greet))
            })
        }
        listen()
    },[])

    const submit=async(data:any)=>{

        console.log(data)
        if(await checkData(data)){
            setData(JSON.stringify(data))
            greet()
        }else{
            setTextBox("Invalid Values were parsed in")
        }
    }


    async function checkData(data:any){
        let schema = yup.object().shape({
            name:yup.string().required().min(5),
            age: yup.number().required().positive().integer(),
            location:yup.string().required().min(5)
            
        })
        const ismatch=await schema.isValid(data)
        return ismatch
    }


    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")
        

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello World"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting:greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head >
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>
                <form onSubmit={handleSubmit(async(data)=>await submit(data))}>
                    <div className='form-div' >
                    <TextField className='form-input'  {...register('name')} id="name" label="Name" variant="standard"></TextField>
                    </div>
                    <div className='form-div' >
                    <TextField
                    className='form-input' 
                    id="age"
                    label="Age"
                    type="number"
                    {...register('age')}
                    />
                    </div>
                    <div className='form-div' >
                    <TextField className='form-input'  {...register('location')} id="location" label="Location" variant="standard"></TextField>
                    </div>
                    {/* <div className='form-div' >
                    <TextField className='form-input'  {...register('message')} id="message" label="Message" variant="standard"></TextField>
                    </div> */}
                    <div className='form-div' >
                    <Button style={{marginLeft:'75px'}} className='form-button'  variant="contained" type='submit'>Submit</Button>
                    </div>
                    <div className='form-div' >
                        <p>{textBox}</p>
                    </div>
                    
                </form>
                {/* <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div> */}
            </main>
        </div>
    )
}

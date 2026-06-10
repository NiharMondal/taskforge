
## Forms Guide
- This is the rules how you implement form where the form need. Follow this pattern
- Make schema using zod in separate file also export the type.
- All form must be re-useable. 
## Example

```
import {
	Form,
	FormTextField,
	FormRadioGroup,
	FormSelect,
	FormTextArea,
	FormComboBox,
} from "@/components/form";
import { useForm } from "react-hook-form";

import { addressSchema, TAddressFormValues } from "./address-form-schema";

type Props = {
    defaultValues?: TAddressFormValues | null;
    onSubmit: (values: TAddressFormValues) => Promise<boolean | void> | boolean | void;
    isSubmitting: boolean;
    onSuccess?: () => void;
};

export default function AddressForm({
    defaultValues,
    onSubmit,
    onSuccess,
    isSubmitting,
}: Props) {
    const methods = useForm<TAddressFormValues>({
        resolver: zodResolver(addressSchema),
        defaultValues: defaultValues ?? {
            fullName: "",
            email: "",
            phone: "",
            street: "",
            city: "",
            state: "",
            postalCode: "",
            country: "",
            isDefault: false,
        },
    });

    const handleAddressSubmit = async (values: TAddressFormValues) => {
        const success = await onSubmit(values);
        if (success) {
            methods.reset();
            onSuccess?.();
        }
    };
    return (
        <FormWrapper methods={methods} onSubmit={handleAddressSubmit}>
            <FormComboBox
                name="fruits"
                label="Fruits"
                isRequired
                options={[
                    { label: "Apple", value: "apple" },
                    { label: "Mango", value: "Mango" },
                ]}
            />
            <FormRadioGroup
                name="gender"
                label="Gender"
                isRequired
                options={[
                    { label: "Male", value: "male" },
                    { label: "Female", value: "female" },
                ]}
            />
            <FormSelect
                name="country"
                label="Country"
                isRequired
                options={[
                    { label: "India", value: "india" },
                    { label: "USA", value: "usa" },
                ]}
            />
            <FormTextArea
                name="about"
                label="About yourself"
                isRequired
                placeholder="Tell us about yourself"
            />
            <FormTextField
                name="username"
                label="Username"
                placeholder="Enter your username"
                isRequired
            />

			<Button type="submit">Submit</Button>
        </FormWrapper>
    );
}
```
